// server.js - A self-contained tool for Gemini CLI

// Node's built-in modules for file system and path manipulation
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const archiver = require('archiver');
const fse = require('fs-extra'); // For ensuring directory exists
const yauzl = require('yauzl');


/**
 * The core function to process tool calls from Gemini.
 * It reads the command and arguments from the command line.
 */
async function main() {
    if (require.main === module) {
        // The Gemini CLI passes the tool name and its arguments
        // process.argv[2] is the tool name (e.g., "listFiles")
        // process.argv[3] is a JSON string of arguments (e.g., '{"directoryPath":"Documents"}')
        const toolName = process.argv[2];
        const args = process.argv[3] ? JSON.parse(process.argv[3]) : {};

        try {
            let result;
            switch (toolName) {
            case 'listFiles':
                result = await listFiles(args);
                break;
            case 'readFile':
                result = await readFile(args);
                break;
            case 'createFile':
                result = await createFile(args);
                break;
            case 'editFile':
                result = await editFile(args);
                break;
            case 'replaceString':
                result = await replaceString(args);
                break;
            case 'deleteFile':
                result = await deleteFile(args);
                break;
            case 'deleteDirectory':
                result = await deleteDirectory(args);
                break;
            case 'renameFile':
                result = await renameFile(args);
                break;
            case 'renameDirectory':
                result = await renameDirectory(args);
                break;
            case 'moveFile':
                result = await moveFile(args);
                break;
            case 'moveDirectory':
                result = await moveDirectory(args);
                break;
            case 'createDirectory':
                result = await createDirectory(args);
                break;
            case 'getFileInfo':
                result = await getFileInfo(args);
                break;
            case 'getDirectoryInfo':
                result = await getDirectoryInfo(args);
                break;
            case 'appendToFile':
                result = await appendToFile(args);
                break;
            case 'prependToFile':
                result = await prependToFile(args);
                break;
            case 'searchInFile':
                result = await searchInFile(args);
                break;
            case 'zipDirectory':
                result = await zipDirectory(args);
                break;
            case 'unzipFile':
                result = await unzipFile(args);
                break;
            case 'changePermissions':
                result = await changePermissions(args);
                break;
            case 'listRecentFiles':
                result = await listRecentFiles(args);
                break;
            case 'searchFiles':
                result = await searchFiles(args);
                break;
            case 'getToolDefinition':
                result = getToolDefinition();
                break;
            default:
                throw new Error(`Unknown tool: ${toolName}`);
            }
            // Output the result as a JSON string for the Gemini CLI to parse
            console.log(JSON.stringify(result, null, 2));
        } catch (error) {
            // Output errors as a JSON object with an error key
            console.error(JSON.stringify({ error: error.message }));
            process.exit(1); // Exit with a non-zero code to indicate failure
        }
    }
}

/**
 * Returns the definition of the tools available in this script.
 * This is used by the Gemini CLI to understand what tools are available.
 */
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
                description: 'Replaces a string in a specified file.',
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
                description: 'Gets information about a file.',
                schema: {
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file. e.g., "Documents/my_notes.txt".' },
                    },
                    required: ['filePath'],
                },
            },
            {
                name: 'getDirectoryInfo',
                description: 'Gets information about a directory.',
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
                description: 'Changes the permissions of a file or directory.',
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
        ],
    };
}

/**
 * Lists files and directories in a given path.
 * For security, this example restricts the path to the user's home directory.
 */
async function listFiles(args) {
    const homeDir = os.homedir();
    const targetPath = args.directoryPath ? path.join(homeDir, args.directoryPath) : homeDir;

    // Security Check: Ensure we don't traverse outside the home directory
    if (!path.resolve(targetPath).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    const files = await fs.readdir(targetPath);
    return { files: files };
}

/**
 * Reads the contents of a file.
 */
async function readFile(args) {
    const homeDir = os.homedir();
    const targetFile = path.join(homeDir, args.filePath);

    // Security Check
    if (!path.resolve(targetFile).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    const content = await fs.readFile(targetFile, 'utf8');
    return { content: content };
}

/**
 * Creates a new file with content.
 */
/**
 * Creates a new file with content.
 */
async function createFile(args) {
    const homeDir = os.homedir();
    const targetFile = path.join(homeDir, args.filePath);

    if (!path.resolve(targetFile).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    try {
        // Use 'wx' flag to fail if the file already exists
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
    const homeDir = os.homedir();
    const targetFile = path.join(homeDir, args.filePath);

    if (!path.resolve(targetFile).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

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
    const homeDir = os.homedir();
    const targetFile = path.join(homeDir, args.filePath);

    if (!path.resolve(targetFile).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    const content = await fs.readFile(targetFile, 'utf8');

    const newContent = content.replace(new RegExp(args.oldString, 'g'), args.newString);

    await fs.writeFile(targetFile, newContent);
    return { content: `Successfully replaced string in file at: ${targetFile}` };
}

async function deleteFile(args) {
    const homeDir = os.homedir();
    const targetFile = path.join(homeDir, args.filePath);

    if (!path.resolve(targetFile).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    await fs.unlink(targetFile);
    return { content: `Successfully deleted file at: ${targetFile}` };
}

async function deleteDirectory(args) {
    const homeDir = os.homedir();
    const targetDirectory = path.join(homeDir, args.directoryPath);

    if (!path.resolve(targetDirectory).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    await fs.rm(targetDirectory, { recursive: true, force: true });
    return { content: `Successfully deleted directory at: ${targetDirectory}` };
}

async function renameFile(args) {
    const homeDir = os.homedir();
    const oldPath = path.join(homeDir, args.oldPath);
    const newPath = path.join(homeDir, args.newPath);

    if (!path.resolve(oldPath).startsWith(homeDir) || !path.resolve(newPath).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    await fs.rename(oldPath, newPath);
    return { content: `Successfully renamed ${oldPath} to ${newPath}` };
}

async function renameDirectory(args) {
    const homeDir = os.homedir();
    const oldPath = path.join(homeDir, args.oldPath);
    const newPath = path.join(homeDir, args.newPath);

    if (!path.resolve(oldPath).startsWith(homeDir) || !path.resolve(newPath).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    await fs.rename(oldPath, newPath);
    return { content: `Successfully renamed directory ${oldPath} to ${newPath}` };
}

async function moveFile(args) {
    const homeDir = os.homedir();
    const sourcePath = path.join(homeDir, args.sourcePath);
    const destinationPath = path.join(homeDir, args.destinationPath);

    if (!path.resolve(sourcePath).startsWith(homeDir) || !path.resolve(destinationPath).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    await fs.rename(sourcePath, destinationPath);
    return { content: `Successfully moved file from ${sourcePath} to ${destinationPath}` };
}

async function moveDirectory(args) {
    const homeDir = os.homedir();
    const sourcePath = path.join(homeDir, args.sourcePath);
    const destinationPath = path.join(homeDir, args.destinationPath);

    if (!path.resolve(sourcePath).startsWith(homeDir) || !path.resolve(destinationPath).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    await fs.rename(sourcePath, destinationPath);
    return { content: `Successfully moved directory from ${sourcePath} to ${destinationPath}` };
}

async function createDirectory(args) {
    const homeDir = os.homedir();
    const targetDirectory = path.join(homeDir, args.directoryPath);

    if (!path.resolve(targetDirectory).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    await fs.mkdir(targetDirectory, { recursive: true });
    return { content: `Successfully created directory at: ${targetDirectory}` };
}

async function getFileInfo(args) {
    const homeDir = os.homedir();
    const targetFile = path.join(homeDir, args.filePath);

    if (!path.resolve(targetFile).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    const stats = await fs.stat(targetFile);
    return {
        content: {
            size: stats.size,
            createdAt: stats.birthtime.toISOString(),
            modifiedAt: stats.mtime.toISOString(),
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
        },
    };
}

async function getDirectoryInfo(args) {
    const homeDir = os.homedir();
    const targetDirectory = path.join(homeDir, args.directoryPath);

    if (!path.resolve(targetDirectory).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

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
        content: {
            fileCount,
            directoryCount,
        },
    };
}

async function appendToFile(args) {
    const homeDir = os.homedir();
    const targetFile = path.join(homeDir, args.filePath);

    if (!path.resolve(targetFile).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    try {
        await fs.appendFile(targetFile, args.content);
        return { content: `Successfully appended to file at: ${targetFile}` };
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`File not found at: ${targetFile}`);
        }
        throw error;
    }
}

async function prependToFile(args) {
    const homeDir = os.homedir();
    const targetFile = path.join(homeDir, args.filePath);

    if (!path.resolve(targetFile).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    try {
        const currentContent = await fs.readFile(targetFile, 'utf8');
        const newContent = args.content + currentContent;
        await fs.writeFile(targetFile, newContent);
        return { content: `Successfully prepended to file at: ${targetFile}` };
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`File not found at: ${targetFile}`);
        }
        throw error;
    }
}

async function searchInFile(args) {
    const homeDir = os.homedir();
    const targetFile = path.join(homeDir, args.filePath);

    if (!path.resolve(targetFile).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    try {
        const content = await fs.readFile(targetFile, 'utf8');
        const lines = content.split(/\r?\n/);
        const matchingLines = [];
        const regex = new RegExp(args.pattern, 'g');

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
    const homeDir = os.homedir();
    const sourceDir = path.join(homeDir, args.directoryPath);
    const outputPath = path.join(homeDir, args.outputPath);

    if (!path.resolve(sourceDir).startsWith(homeDir) || !path.resolve(outputPath).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
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
    const homeDir = os.homedir();
    const sourceFile = path.join(homeDir, args.filePath);
    const destinationPath = path.join(homeDir, args.destinationPath);

    if (!path.resolve(sourceFile).startsWith(homeDir) || !path.resolve(destinationPath).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    try {
        await fse.ensureDir(destinationPath);

        return new Promise((resolve, reject) => {
            yauzl.open(sourceFile, { lazyEntries: true }, (err, zipfile) => {
                if (err) reject(err);

                zipfile.readEntry();

                zipfile.on('entry', (entry) => {
                    const entryPath = path.join(destinationPath, entry.fileName);

                    if (/\/$/.test(entry.fileName)) {
                        // Directory file names end with /
                        fse.ensureDir(entryPath).then(() => zipfile.readEntry()).catch(reject);
                    } else {
                        // File
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
    const homeDir = os.homedir();
    const targetPath = path.join(homeDir, args.filePath);

    if (!path.resolve(targetPath).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

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
    const homeDir = os.homedir();
    const targetPath = args.directoryPath ? path.join(homeDir, args.directoryPath) : homeDir;
    const limit = args.limit || 10;

    if (!path.resolve(targetPath).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

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
    const homeDir = os.homedir();
    const targetPath = args.directoryPath ? path.join(homeDir, args.directoryPath) : homeDir;
    const fileNamePattern = args.fileNamePattern ? new RegExp(args.fileNamePattern) : null;
    const minSize = args.minSize || 0;
    const maxSize = args.maxSize || Infinity;
    const modifiedSince = args.modifiedSince || 0;

    if (!path.resolve(targetPath).startsWith(homeDir)) {
        throw new Error('Access is restricted to your user profile directory.');
    }

    try {
        const files = await fs.readdir(targetPath);
        const matchingFiles = [];

        for (const file of files) {
            const filePath = path.join(targetPath, file);
            try {
                const stats = await fs.stat(filePath);
                if (stats.isFile()) {
                    let matches = true;
                    if (fileNamePattern && !fileNamePattern.test(file)) {
                        matches = false;
                    }
                    if (stats.size < minSize || stats.size > maxSize) {
                        matches = false;
                    }
                    if (stats.mtime.getTime() < modifiedSince) {
                        matches = false;
                    }

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

if (require.main === module) {
    main();
}

module.exports = {
    listFiles,
    readFile,
    createFile,
    editFile,
    replaceString,
    deleteFile,
    deleteDirectory,
    renameFile,
    renameDirectory,
    moveFile,
    moveDirectory,
    createDirectory,
    getFileInfo,
    getDirectoryInfo,
    appendToFile,
    prependToFile,
    searchInFile,
    zipDirectory,
    unzipFile,
    changePermissions,
    listRecentFiles,
    searchFiles,
    getToolDefinition,
};