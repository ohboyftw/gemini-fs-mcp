// server.js - A self-contained tool for Gemini CLI

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const archiver = require('archiver');
const fse = require('fs-extra');
const yauzl = require('yauzl');
const fuzzaldrin = require('fuzzaldrin');
const MarkdownIt = require('markdown-it');
const puppeteer = require('puppeteer');

/**
 * Securely resolve a user-supplied path relative to the home directory.
 * Throws if the path is outside the home directory or contains path traversal.
 */
function resolveUserPath(userPath) {
    const homeDir = os.homedir();
    if (typeof userPath !== 'string' || path.isAbsolute(userPath) || userPath.includes('..') || userPath.startsWith('\\\\')) {
        throw new Error('Access is restricted to your user profile directory.');
    }
    const absPath = path.resolve(homeDir, userPath);
    const normalizedHome = path.normalize(homeDir + path.sep);
    const normalizedAbs = path.normalize(absPath + path.sep);
    if (!normalizedAbs.startsWith(normalizedHome)) {
        throw new Error('Access is restricted to your user profile directory.');
    }
    return absPath;
}

// --- File and Directory Operations ---

async function listFiles(args) {
    const targetPath = args.directoryPath ? resolveUserPath(args.directoryPath) : os.homedir();
    const files = await fs.readdir(targetPath);
    return { files: files };
}

async function readFile(args) {
    const targetFile = resolveUserPath(args.filePath);
    const content = await fs.readFile(targetFile, 'utf8');
    return { content: content };
}

async function createFile(args) {
    const targetFile = resolveUserPath(args.filePath);
    try {
        await fs.writeFile(targetFile, args.content, { flag: 'wx' });
    } catch (err) {
        if (err.code === 'EEXIST') {
            throw new Error('File already exists');
        }
        throw err;
    }
    return { content: `Successfully created file at: ${targetFile}` };
}

async function editFile(args) {
    const targetFile = resolveUserPath(args.filePath);
    const content = await fs.readFile(targetFile, 'utf8');
    const occurrences = (content.match(new RegExp(args.oldContent, 'g')) || []).length;
    if (occurrences === 0) {
        throw new Error(`The oldContent was not found. No changes made to file at: ${targetFile}`);
    }
    if (occurrences > 1) {
        throw new Error(`The oldContent is not unique in the file. Found ${occurrences} occurrences.`);
    }
    const newContent = content.replace(args.oldContent, args.newContent);
    await fs.writeFile(targetFile, newContent);
    return { content: `Successfully edited file at: ${targetFile}` };
}

async function replaceString(args) {
    const targetFile = resolveUserPath(args.filePath);
    const content = await fs.readFile(targetFile, 'utf8');
    const newContent = content.replace(new RegExp(args.oldString, 'g'), args.newString);
    await fs.writeFile(targetFile, newContent);
    return { content: `Successfully replaced string in file at: ${targetFile}` };
}

async function deleteFile(args) {
    const targetFile = resolveUserPath(args.filePath);
    await fs.unlink(targetFile);
    return { content: `Successfully deleted file at: ${targetFile}` };
}

async function deleteDirectory(args) {
    const targetDirectory = resolveUserPath(args.directoryPath);
    await fs.rm(targetDirectory, { recursive: true, force: true });
    return { content: `Successfully deleted directory at: ${targetDirectory}` };
}

async function renameFile(args) {
    const oldPath = resolveUserPath(args.oldPath);
    const newPath = resolveUserPath(args.newPath);
    await fs.rename(oldPath, newPath);
    return { content: `Successfully renamed ${oldPath} to ${newPath}` };
}

async function renameDirectory(args) {
    const oldPath = resolveUserPath(args.oldPath);
    const newPath = resolveUserPath(args.newPath);
    await fs.rename(oldPath, newPath);
    return { content: `Successfully renamed directory ${oldPath} to ${newPath}` };
}

async function moveFile(args) {
    const sourcePath = resolveUserPath(args.sourcePath);
    const destinationPath = resolveUserPath(args.destinationPath);
    await fs.rename(sourcePath, destinationPath);
    return { content: `Successfully moved file from ${sourcePath} to ${destinationPath}` };
}

async function getFileInfo(args) {
    const targetFile = resolveUserPath(args.filePath);
    const stats = await fs.stat(targetFile);
    return {
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
    };
}

async function getDirectoryInfo(args) {
    const targetDirectory = resolveUserPath(args.directoryPath);
    const files = await fs.readdir(targetDirectory);
    let fileCount = 0;
    let directoryCount = 0;
    for (const file of files) {
        const itemPath = path.join(targetDirectory, file);
        const stats = await fs.stat(itemPath);
        if (stats.isFile()) {
            fileCount++;
        } else if (stats.isDirectory()) {
            directoryCount++;
        }
    }
    return {
        isDirectory: true,
        fileCount,
        directoryCount,
    };
}

async function moveDirectory(args) {
    const sourcePath = resolveUserPath(args.sourcePath);
    const destinationPath = resolveUserPath(args.destinationPath);
    await fs.rename(sourcePath, destinationPath);
    return { content: `Successfully moved directory from ${sourcePath} to ${destinationPath}` };
}

async function createDirectory(args) {
    const targetDirectory = resolveUserPath(args.directoryPath);
    await fs.mkdir(targetDirectory, { recursive: true });
    return { content: `Successfully created directory at: ${targetDirectory}` };
}

async function appendToFile(args) {
    const targetFile = resolveUserPath(args.filePath);
    try {
        // Ensure file exists before appending
        await fs.access(targetFile);
        await fs.appendFile(targetFile, args.content);
        return { content: `Successfully appended to file at: ${targetFile}` };
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`ENOENT: File does not exist at: ${targetFile}`);
        }
        throw error;
    }
}

async function prependToFile(args) {
    const targetFile = resolveUserPath(args.filePath);
    try {
        // Ensure file exists before prepending
        await fs.access(targetFile);
        const currentContent = await fs.readFile(targetFile, 'utf8');
        const newContent = args.content + currentContent;
        await fs.writeFile(targetFile, newContent);
        return { content: `Successfully prepended to file at: ${targetFile}` };
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`ENOENT: File does not exist at: ${targetFile}`);
        }
        throw error;
    }
}

async function searchInFile(args) {
    const targetFile = resolveUserPath(args.filePath);
    try {
        const content = await fs.readFile(targetFile, 'utf8');
        const lines = content.split(/\r?\n/);
        const matchingLines = [];
        // Remove 'g' flag to avoid stateful regex issues
        const regex = new RegExp(args.pattern);
        for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
                matchingLines.push({ lineNumber: i + 1, lineContent: lines[i] });
            }
        }
        return { content: matchingLines };
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`File not found at: ${targetFile}`);
        }
        throw error;
    }
}

async function zipDirectory(args) {
    const sourceDir = resolveUserPath(args.directoryPath);
    const outputPath = resolveUserPath(args.outputPath);
    // Ensure source directory exists
    if (!fsSync.existsSync(sourceDir)) {
        throw new Error(`ENOENT: Directory not found at: ${sourceDir}`);
    }
    try {
        await fse.ensureDir(path.dirname(outputPath));
        const output = fse.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        return new Promise((resolve, reject) => {
            output.on('close', () => {
                resolve({ content: `Successfully zipped ${sourceDir} to ${outputPath}. Total bytes: ${archive.pointer()}` });
            });
            archive.on('error', (err) => reject(err));
            archive.pipe(output);
            archive.directory(sourceDir, false);
            archive.finalize();
        });
    } catch (error) {
        throw error;
    }
}

async function unzipFile(args) {
    const sourceFile = resolveUserPath(args.filePath);
    const destinationPath = resolveUserPath(args.destinationPath);
    try {
        await fse.ensureDir(destinationPath);
        return new Promise((resolve, reject) => {
            yauzl.open(sourceFile, { lazyEntries: true }, (err, zipfile) => {
                if (err) reject(err);
                zipfile.readEntry();
                zipfile.on('entry', (entry) => {
                    const entryPath = path.join(destinationPath, entry.fileName);
                    if (/\/$/.test(entry.fileName)) {
                        fse.ensureDir(entryPath).then(() => zipfile.readEntry()).catch(reject);
                    } else {
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) reject(err);
                            readStream.on('end', () => {
                                zipfile.readEntry();
                            });
                            fse.ensureDir(path.dirname(entryPath)).then(() => {
                                const writeStream = fse.createWriteStream(entryPath);
                                readStream.pipe(writeStream);
                            }).catch(reject);
                        });
                    }
                });
                zipfile.on('end', () => {
                    resolve({ content: `Successfully unzipped ${sourceFile} to ${destinationPath}` });
                });
            });
        });
    } catch (error) {
        throw error;
    }
}

async function changePermissions(args) {
    const targetPath = resolveUserPath(args.filePath);
    try {
        await fs.chmod(targetPath, args.mode);
        return { content: `Successfully changed permissions for ${targetPath} to ${args.mode.toString(8)}` };
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`File or directory not found at: ${targetPath}`);
        }
        throw error;
    }
}

async function listRecentFiles(args) {
    const targetPath = args.directoryPath ? resolveUserPath(args.directoryPath) : os.homedir();
    const limit = args.limit || 10;
    try {
        const files = await fs.readdir(targetPath);
        const fileStats = [];
        for (const file of files) {
            const filePath = path.join(targetPath, file);
            try {
                const stats = await fs.stat(filePath);
                if (stats.isFile()) {
                    fileStats.push({ name: file, modifiedAt: stats.mtime.getTime() });
                }
            } catch (error) {
                // Ignore errors for files that might have been deleted between readdir and stat
            }
        }
        fileStats.sort((a, b) => b.modifiedAt - a.modifiedAt);
        return { content: fileStats.slice(0, limit) };
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`Directory not found at: ${targetPath}`);
        }
        throw error;
    }
}

async function searchFiles(args) {
    const targetPath = args.directoryPath ? resolveUserPath(args.directoryPath) : os.homedir();
    const fileNamePattern = args.fileNamePattern ? args.fileNamePattern.toLowerCase() : null;
    const minSize = args.minSize || 0;
    const maxSize = args.maxSize || Infinity;
    const modifiedSince = args.modifiedSince || 0;
    try {
        const files = await fs.readdir(targetPath);
        let filteredFiles = files;
        if (fileNamePattern) {
            filteredFiles = fuzzaldrin.filter(files, fileNamePattern);
        }
        const matchingFiles = [];
        for (const file of filteredFiles) {
            const filePath = path.join(targetPath, file);
            try {
                const stats = await fs.stat(filePath);
                if (stats.isFile()) {
                    let matches = true;
                    if (stats.size < minSize || stats.size > maxSize) matches = false;
                    if (stats.mtime.getTime() < modifiedSince) matches = false;
                    if (matches) {
                        matchingFiles.push({
                            name: file,
                            path: filePath,
                            size: stats.size,
                            modifiedAt: stats.mtime.toISOString(),
                        });
                    }
                }
            } catch (error) {
                // Ignore errors for files that might have been deleted between readdir and stat
            }
        }
        return { content: matchingFiles };
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`Directory not found at: ${targetPath}`);
        }
        throw error;
    }
}

async function saveContentToFile(args) {
    const targetFile = resolveUserPath(args.filePath);
    await fs.mkdir(path.dirname(targetFile), { recursive: true });
    const flag = args.overwrite ? 'w' : 'wx';
    await fs.writeFile(targetFile, args.content, { flag });
    return { content: `Successfully saved content to file at: ${targetFile}` };
}

async function exportContent(args) {
    const absOutput = resolveUserPath(args.outputPath);
    await fs.mkdir(path.dirname(absOutput), { recursive: true });
    let markdownContent = '';
    if (args.sourceType === 'text') {
        markdownContent = args.source;
    } else if (args.sourceType === 'file') {
        const absSource = resolveUserPath(args.source);
        markdownContent = await fs.readFile(absSource, 'utf8');
    } else {
        throw new Error('Invalid sourceType. Use "text" or "file".');
    }
    if (args.format === 'md') {
        await fs.writeFile(absOutput, markdownContent, { flag: 'w' });
        return { content: `Successfully exported as markdown: ${absOutput}` };
    } else if (args.format === 'pdf') {
        const md = new MarkdownIt();
        const html = md.render(markdownContent);
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.pdf({ path: absOutput, format: 'A4' });
        await browser.close();
        return { content: `Successfully exported as PDF: ${absOutput}` };
    } else {
        throw new Error('Invalid format. Use "md" or "pdf".');
    }
}

// --- Tool Definition (for Gemini CLI) ---

function getToolDefinition() {
    return {
        name: 'fs-windows',
        description: 'A tool for performing file system operations on Windows.',
        tools: [
            {
                name: 'listFiles',
                description: 'Lists files and folders in a specified directory relative to your home folder. Defaults to the home folder.',
                schema: {
                    properties: {
                        directoryPath: { type: 'string', description: 'e.g., "Documents" or "Downloads".' },
                    },
                },
            },
            {
                name: 'readFile',
                description: 'Reads the contents of a specified file.',
                schema: {
                    properties: { filePath: { type: 'string', description: 'Path relative to your home folder. e.g., "Documents/my_notes.txt".' } },
                    required: ['filePath'],
                },
            },
            {
                name: 'createFile',
                description: 'Creates a new file with content. Fails if the file already exists.',
                schema: {
                    properties: {
                        filePath: { type: 'string', description: 'Path for the new file. e.g., "Desktop/new_file.txt".' },
                        content: { type: 'string', description: 'The content to write into the new file.' },
                    },
                    required: ['filePath', 'content'],
                },
            },
            {
                name: 'editFile',
                description: 'Edits an existing file by replacing a unique string. Fails if the file does not exist or the string is not unique.',
                schema: {
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file to edit. e.g., "Documents/my_notes.txt".' },
                        oldContent: { type: 'string', description: 'The unique content to be replaced.' },
                        newContent: { type: 'string', description: 'The new content to write to the file.' },
                    },
                    required: ['filePath', 'oldContent', 'newContent'],
                },
            },
            {
                name: 'replaceString',
                description: 'Replaces all occurrences of a string in a specified file.',
                schema: {
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file. e.g., "Documents/my_notes.txt".' },
                        oldString: { type: 'string', description: 'The string to be replaced.' },
                        newString: { type: 'string', description: 'The string to replace with.' },
                    },
                    required: ['filePath', 'oldString', 'newString'],
                },
            },
            {
                name: 'deleteFile',
                description: 'Deletes a specified file.',
                schema: {
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file to delete. e.g., "Documents/my_notes.txt".' },
                    },
                    required: ['filePath'],
                },
            },
            {
                name: 'deleteDirectory',
                description: 'Deletes a specified directory and its contents recursively.',
                schema: {
                    properties: {
                        directoryPath: { type: 'string', description: 'Path to the directory to delete. e.g., "Documents/my_folder".' },
                    },
                    required: ['directoryPath'],
                },
            },
            {
                name: 'renameFile',
                description: 'Renames a specified file.',
                schema: {
                    properties: {
                        oldPath: { type: 'string', description: 'Current path of the file. e.g., "Documents/old_name.txt".' },
                        newPath: { type: 'string', description: 'New path/name for the file. e.g., "Documents/new_name.txt".' },
                    },
                    required: ['oldPath', 'newPath'],
                },
            },
            {
                name: 'renameDirectory',
                description: 'Renames a specified directory.',
                schema: {
                    properties: {
                        oldPath: { type: 'string', description: 'Current path of the directory. e.g., "Documents/old_folder".' },
                        newPath: { type: 'string', description: 'New path/name for the directory. e.g., "Documents/new_folder".' },
                    },
                    required: ['oldPath', 'newPath'],
                },
            },
            {
                name: 'moveFile',
                description: 'Moves a file from a source to a destination path.',
                schema: {
                    properties: {
                        sourcePath: { type: 'string', description: 'Current path of the file. e.g., "Documents/my_file.txt".' },
                        destinationPath: { type: 'string', description: 'New path for the file. e.g., "Downloads/my_file.txt".' },
                    },
                    required: ['sourcePath', 'destinationPath'],
                },
            },
            {
                name: 'moveDirectory',
                description: 'Moves a directory from a source to a destination path.',
                schema: {
                    properties: {
                        sourcePath: { type: 'string', description: 'Current path of the directory. e.g., "Documents/my_folder".' },
                        destinationPath: { type: 'string', description: 'New path for the directory. e.g., "Downloads/my_folder".' },
                    },
                    required: ['sourcePath', 'destinationPath'],
                },
            },
            {
                name: 'createDirectory',
                description: 'Creates a new directory.',
                schema: {
                    properties: {
                        directoryPath: { type: 'string', description: 'Path for the new directory. e.g., "Desktop/new_folder".' },
                    },
                    required: ['directoryPath'],
                },
            },
            {
                name: 'getFileInfo',
                description: 'Gets information about a file (size, creation date, modification date, etc.).',
                schema: {
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file. e.g., "Documents/my_notes.txt".' },
                    },
                    required: ['filePath'],
                },
            },
            {
                name: 'getDirectoryInfo',
                description: 'Gets information about a directory (number of files and subdirectories).',
                schema: {
                    properties: {
                        directoryPath: { type: 'string', description: 'Path to the directory. e.g., "Documents/my_folder".' },
                    },
                    required: ['directoryPath'],
                },
            },
            {
                name: 'appendToFile',
                description: 'Appends content to the end of a file.',
                schema: {
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file. e.g., "Documents/my_notes.txt".' },
                        content: { type: 'string', description: 'The content to append to the file.' },
                    },
                    required: ['filePath', 'content'],
                },
            },
            {
                name: 'prependToFile',
                description: 'Prepends content to the beginning of a file.',
                schema: {
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file. e.g., "Documents/my_notes.txt".' },
                        content: { type: 'string', description: 'The content to prepend to the file.' },
                    },
                    required: ['filePath', 'content'],
                },
            },
            {
                name: 'searchInFile',
                description: 'Searches for a string or pattern within a file and returns matching lines.',
                schema: {
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file. e.g., "Documents/my_notes.txt".' },
                        pattern: { type: 'string', description: 'The string or regex pattern to search for.' },
                    },
                    required: ['filePath', 'pattern'],
                },
            },
            {
                name: 'zipDirectory',
                description: 'Compresses a directory into a zip file. Requires `archiver` and `fs-extra` packages.',
                schema: {
                    properties: {
                        directoryPath: { type: 'string', description: 'Path to the directory to zip. e.g., "Documents/my_folder".' },
                        outputPath: { type: 'string', description: 'Path for the output zip file. e.g., "Documents/my_folder.zip".' },
                    },
                    required: ['directoryPath', 'outputPath'],
                },
            },
            {
                name: 'unzipFile',
                description: 'Extracts the contents of a zip file. Requires `yauzl` and `fs-extra` packages.',
                schema: {
                    properties: {
                        filePath: { type: 'string', description: 'Path to the zip file. e.g., "Documents/my_archive.zip".' },
                        destinationPath: { type: 'string', description: 'Path for the extraction destination. e.g., "Documents/extracted_folder".' },
                    },
                    required: ['filePath', 'destinationPath'],
                },
            },
            {
                name: 'changePermissions',
                description: 'Changes the permissions of a file or directory. Requires an octal permission mode (e.g., 0o755 for rwxr-xr-x).',
                schema: {
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file or directory. e.g., "Documents/my_file.txt".' },
                        mode: { type: 'number', description: 'The octal permission mode (e.g., 0o755 for rwxr-xr-x).', format: 'int32' },
                    },
                    required: ['filePath', 'mode'],
                },
            },
            {
                name: 'listRecentFiles',
                description: 'Lists the most recently modified files in a directory.',
                schema: {
                    properties: {
                        directoryPath: { type: 'string', description: 'Path to the directory. Defaults to the home folder.' },
                        limit: { type: 'number', description: 'Maximum number of files to return. Defaults to 10.', format: 'int32' },
                    },
                },
            },
            {
                name: 'searchFiles',
                description: 'Searches for files based on their name, size, or modification date.',
                schema: {
                    properties: {
                        directoryPath: { type: 'string', description: 'Path to the directory to search within. Defaults to the home folder.' },
                        fileNamePattern: { type: 'string', description: 'Regex pattern to match file names.' },
                        minSize: { type: 'number', description: 'Minimum file size in bytes.', format: 'int32' },
                        maxSize: { type: 'number', description: 'Maximum file size in bytes.', format: 'int32' },
                        modifiedSince: { type: 'number', description: 'Timestamp (milliseconds) to find files modified after.', format: 'int64' },
                    },
                },
            },
            {
                name: 'saveContentToFile',
                description: 'Saves provided content to a specified file. Can be used to store results from other MCPs.',
                schema: {
                    properties: {
                        filePath: { type: 'string', description: 'Path for the file. e.g., "Desktop/data.txt".' },
                        content: { type: 'string', description: 'The content to write into the file.' },
                        overwrite: { type: 'boolean', description: 'Whether to overwrite if the file exists. Default: false.' }
                    },
                    required: ['filePath', 'content']
                },
            },
            {
                name: 'exportContent',
                description: 'Exports user-specified text or file as markdown or PDF.',
                schema: {
                    properties: {
                        sourceType: { type: 'string', description: '"text" or "file"' },
                        source: { type: 'string', description: 'Raw text or file path (relative to home)' },
                        format: { type: 'string', description: '"md" or "pdf"' },
                        outputPath: { type: 'string', description: 'Output file path (relative to home)' }
                    },
                    required: ['sourceType', 'source', 'format', 'outputPath']
                },
            },
        ],
    };
}

// --- Main Entrypoint ---

async function main() {
    if (require.main === module) {
        const toolName = process.argv[2];
        const args = process.argv[3] ? JSON.parse(process.argv[3]) : {};
        try {
            let result;
            switch (toolName) {
                case 'listFiles': result = await listFiles(args); break;
                case 'readFile': result = await readFile(args); break;
                case 'createFile': result = await createFile(args); break;
                case 'editFile': result = await editFile(args); break;
                case 'replaceString': result = await replaceString(args); break;
                case 'deleteFile': result = await deleteFile(args); break;
                case 'deleteDirectory': result = await deleteDirectory(args); break;
                case 'renameFile': result = await renameFile(args); break;
                case 'renameDirectory': result = await renameDirectory(args); break;
                case 'moveFile': result = await moveFile(args); break;
                case 'moveDirectory': result = await moveDirectory(args); break;
                case 'createDirectory': result = await createDirectory(args); break;
                case 'getFileInfo': result = await getFileInfo(args); break;
                case 'getDirectoryInfo': result = await getDirectoryInfo(args); break;
                case 'appendToFile': result = await appendToFile(args); break;
                case 'prependToFile': result = await prependToFile(args); break;
                case 'searchInFile': result = await searchInFile(args); break;
                case 'zipDirectory': result = await zipDirectory(args); break;
                case 'unzipFile': result = await unzipFile(args); break;
                case 'changePermissions': result = await changePermissions(args); break;
                case 'listRecentFiles': result = await listRecentFiles(args); break;
                case 'searchFiles': result = await searchFiles(args); break;
                case 'getToolDefinition': result = getToolDefinition(); break;
                case 'saveContentToFile': result = await saveContentToFile(args); break;
                case 'exportContent': result = await exportContent(args); break;
                default: throw new Error(`Unknown tool: ${toolName}`);
            }
            console.log(JSON.stringify(result, null, 2));
        } catch (error) {
            console.error(JSON.stringify({ error: error.message }));
            process.exit(1);
        }
    }
}

// --- Exports ---

module.exports = {
    zipDirectory,
    unzipFile,
    changePermissions,
    listRecentFiles,
    searchFiles,
    exportContent,
    saveContentToFile,
    getFileInfo,
    getDirectoryInfo,
    appendToFile,
    prependToFile,
    searchInFile,
    listFiles,
    readFile,
    createFile,
    editFile,
    replaceString,
    createDirectory,
    deleteDirectory,
    renameDirectory,
    moveDirectory,
    renameFile,
    moveFile,
    resolveUserPath,
    main,
    getToolDefinition,
};