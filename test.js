const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised.default);
const { expect } = chai;
const {
  zipDirectory, unzipFile, changePermissions, listRecentFiles, searchFiles,
  exportContent, saveContentToFile, getFileInfo, getDirectoryInfo,
  appendToFile, prependToFile, searchInFile,
  listFiles, readFile, createFile, editFile, replaceString,
  createDirectory, deleteDirectory, renameDirectory, moveDirectory
} = require('./server.js');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;

// Helper to create and clean up test files/directories
async function setupTestDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}
async function cleanupTestDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

describe('Advanced and Edge Case Tests', () => {
  const home = os.homedir();
  const testDir = path.join(home, 'test-advanced');
  const testFile = path.join(testDir, 'file.txt');
  const testFile2 = path.join(testDir, 'file2.txt');
  const zipPath = path.join(testDir, 'archive.zip');
  const unzipDir = path.join(testDir, 'unzipped');
  const exportMd = path.join(testDir, 'export.md');
  const exportPdf = path.join(testDir, 'export.pdf');

  before(async () => {
    await setupTestDir(testDir);
    await fs.writeFile(testFile, 'Hello\nWorld\nTest\n');
    await fs.writeFile(testFile2, 'Another file\n');
  });

  after(async () => {
    await cleanupTestDir(testDir);
  });

  // --- ZIP/UNZIP ---
  it('zipDirectory and unzipFile: round-trip', async () => {
    // Use a sibling directory in the home directory for the archive
    const home = os.homedir();
    const zipOutputDir = path.join(home, 'test-advanced-zip-output');
    const archivePath = path.join(zipOutputDir, 'archive.zip');
    const unzipPath = path.join(home, 'test-advanced', 'unzipped');

    // Clean up any previous runs
    try { await fs.rm(zipOutputDir, { recursive: true, force: true }); } catch (e) {}
    try { await fs.rm(unzipPath, { recursive: true, force: true }); } catch (e) {}
    await fs.mkdir(zipOutputDir, { recursive: true });

    await zipDirectory({ directoryPath: 'test-advanced', outputPath: path.relative(home, archivePath) });
    await unzipFile({ filePath: path.relative(home, archivePath), destinationPath: 'test-advanced/unzipped' });
    const files = await fs.readdir(unzipPath);
    expect(files).to.have.members(['file.txt', 'file2.txt']);
    await fs.unlink(archivePath);
    // Optionally clean up the zip output dir
    try { await fs.rmdir(zipOutputDir); } catch (e) {}
  });

  it('zipDirectory: error on non-existent directory', async () => {
    await expect(zipDirectory({ directoryPath: 'does-not-exist', outputPath: 'test-advanced/shouldnot.zip' }))
      .to.be.rejectedWith(/ENOENT|not exist/i);
  });

  // --- PERMISSIONS ---
  it('changePermissions: changes file mode', async () => {
    // Only test that it does not throw (Windows ignores mode bits)
    await expect(changePermissions({ filePath: 'test-advanced/file.txt', mode: 0o644 })).to.eventually.not.be.undefined;
  });

  it('changePermissions: error on non-existent file', async () => {
    await expect(changePermissions({ filePath: 'test-advanced/nope.txt', mode: 0o644 }))
      .to.be.rejectedWith(/not found/i);
  });

  // --- RECENT FILES ---
  it('listRecentFiles: returns most recent files', async () => {
    try { await fs.unlink(path.join(testDir, 'archive.zip')); } catch (e) {}
    const result = await listRecentFiles({ directoryPath: 'test-advanced', limit: 1 });
    expect(result.content.length).to.equal(1);
    expect(result.content[0].name).to.match(/file/);
  });

  it('listRecentFiles: error on non-existent directory', async () => {
    await expect(listRecentFiles({ directoryPath: 'does-not-exist' }))
      .to.be.rejectedWith(/not found/i);
  });

  // --- SEARCH FILES ---
  it('searchFiles: finds file by name pattern', async () => {
    const result = await searchFiles({ directoryPath: 'test-advanced', fileNamePattern: 'file' });
    expect(result.content.some(f => f.name === 'file.txt')).to.be.true;
  });

  it('searchFiles: respects minSize/maxSize', async () => {
    const result = await searchFiles({ directoryPath: 'test-advanced', minSize: 1, maxSize: 5 });
    expect(result.content.length).to.equal(0); // All files are larger
  });

  // --- EXPORT CONTENT ---
  it('exportContent: exports text as markdown', async () => {
    const result = await exportContent({
      sourceType: 'text',
      source: '# Title\nSome text',
      format: 'md',
      outputPath: 'test-advanced/export.md'
    });
    expect(result.content).to.match(/Successfully exported as markdown/);
    const md = await fs.readFile(exportMd, 'utf8');
    expect(md).to.include('# Title');
    expect(md).to.include('Some text');
  });

  it('exportContent: exports file as PDF', async () => {
    const result = await exportContent({
      sourceType: 'file',
      source: 'test-advanced/file.txt',
      format: 'pdf',
      outputPath: 'test-advanced/export.pdf'
    });
    expect(result.content).to.match(/Successfully exported as PDF/);
    const stat = await fs.stat(exportPdf);
    expect(stat.size).to.be.greaterThan(0);
  });

  it('exportContent: error on invalid sourceType', async () => {
    await expect(exportContent({
      sourceType: 'invalid',
      source: 'foo',
      format: 'md',
      outputPath: 'test-advanced/err.md'
    })).to.be.rejectedWith(/Invalid sourceType/);
  });

  it('exportContent: error on invalid format', async () => {
    await expect(exportContent({
      sourceType: 'text',
      source: 'foo',
      format: 'docx',
      outputPath: 'test-advanced/err.docx'
    })).to.be.rejectedWith(/Invalid format/);
  });

  // --- SAVE CONTENT TO FILE ---
  it('saveContentToFile: creates and overwrites file', async () => {
    await saveContentToFile({ filePath: 'test-advanced/new.txt', content: 'abc', overwrite: false });
    await expect(saveContentToFile({ filePath: 'test-advanced/new.txt', content: 'def', overwrite: false }))
      .to.be.rejectedWith(/already exists/i);
    await saveContentToFile({ filePath: 'test-advanced/new.txt', content: 'def', overwrite: true });
    const txt = await fs.readFile(path.join(testDir, 'new.txt'), 'utf8');
    expect(txt).to.equal('def');
  });

  // --- FILE/DIR INFO EDGE CASES ---
  it('getFileInfo: error on non-existent file', async () => {
    await expect(getFileInfo({ filePath: 'test-advanced/nope.txt' }))
      .to.be.rejectedWith(/ENOENT|not exist/i);
  });

  it('getDirectoryInfo: error on non-existent directory', async () => {
    await expect(getDirectoryInfo({ directoryPath: 'test-advanced/nope' }))
      .to.be.rejectedWith(/ENOENT|not exist/i);
  });

  // --- APPEND/PREPEND/SEARCH EDGE CASES ---
  it('appendToFile: error on non-existent file', async () => {
    await expect(appendToFile({ filePath: 'test-advanced/nope.txt', content: 'x' }))
      .to.be.rejectedWith(/ENOENT|not exist/i);
  });

  it('prependToFile: error on non-existent file', async () => {
    await expect(prependToFile({ filePath: 'test-advanced/nope.txt', content: 'x' }))
      .to.be.rejectedWith(/ENOENT|not exist/i);
  });

  it('searchInFile: finds matching lines', async () => {
    const result = await searchInFile({ filePath: 'test-advanced/file.txt', pattern: 'World' });
    expect(result.content.length).to.equal(1);
    expect(result.content[0].lineContent).to.equal('World');
    await expect(searchInFile({ filePath: 'test-advanced/nope.txt', pattern: 'x' }))
      .to.be.rejectedWith(/not found/i);
  });

  // --- SECURITY: PATH TRAVERSAL ---
  it('rejects path traversal in all operations', async () => {
    const badPaths = [
      '../outside.txt',
      '..\\outside.txt',
      '/etc/passwd',
      '\\\\evil\\share',
      'C:\\Windows\\system32\\cmd.exe'
    ];
    for (const bad of badPaths) {
      await expect(getFileInfo({ filePath: bad })).to.be.rejectedWith(/restricted/i);
      await expect(getDirectoryInfo({ directoryPath: bad })).to.be.rejectedWith(/restricted/i);
      await expect(appendToFile({ filePath: bad, content: 'x' })).to.be.rejectedWith(/restricted/i);
      await expect(prependToFile({ filePath: bad, content: 'x' })).to.be.rejectedWith(/restricted/i);
      await expect(searchInFile({ filePath: bad, pattern: 'x' })).to.be.rejectedWith(/restricted/i);
      await expect(saveContentToFile({ filePath: bad, content: 'x', overwrite: true })).to.be.rejectedWith(/restricted/i);
      await expect(exportContent({ sourceType: 'file', source: bad, format: 'md', outputPath: 'test-advanced/evil.md' })).to.be.rejectedWith(/restricted/i);
    }
  });
});

describe('File System Operations', () => {
    const testDir = path.join(os.homedir(), 'test_fs_mcp');
    const testFile = path.join(testDir, 'test_file.txt');
    const testSubDir = path.join(testDir, 'test_sub_dir');

    before(async () => {
        // Create a test directory and file before running tests
        await fs.mkdir(testDir, { recursive: true });
        await fs.writeFile(testFile, 'Hello, world!');
        await fs.mkdir(testSubDir, { recursive: true });
    });

    after(async () => {
        // Clean up the test directory after all tests are done
        await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('listFiles', () => {
        it('should list files and directories in the specified path', async () => {
            const result = await listFiles({ directoryPath: getHomeRelativePath(testDir) });
            expect(result.files).to.include('test_file.txt');
            expect(result.files).to.include('test_sub_dir');
        });
    });

    describe('readFile', () => {
        it('should read the content of a specified file', async () => {
            const result = await readFile({ filePath: getHomeRelativePath(testFile) });
            expect(result.content).to.equal('Hello, world!');
        });

        it('should throw an error if the file does not exist', async () => {
            await expect(readFile({ filePath: getHomeRelativePath(path.join(testDir, 'non_existent_file.txt')) }))
                .to.be.rejectedWith(/ENOENT/);
        });
    });

    describe('createFile', () => {
        const newFile = path.join(testDir, 'new_file.txt');

        afterEach(async () => {
            // Clean up the new file after each test
            try {
                await fs.unlink(newFile);
            } catch (error) {
                // Ignore if file doesn't exist
            }
        });

        it('should create a new file with content', async () => {
            const result = await createFile({ filePath: getHomeRelativePath(newFile), content: 'New file content' });
            expect(result.content).to.equal(`Successfully created file at: ${newFile}`);
            const content = await fs.readFile(newFile, 'utf8');
            expect(content).to.equal('New file content');
        });

        it('should throw an error if the file already exists', async () => {
            await createFile({ filePath: getHomeRelativePath(newFile), content: 'Initial content' });
            await expect(createFile({ filePath: getHomeRelativePath(newFile), content: 'New content' }))
                .to.be.rejectedWith(/File already exists/);
        });
    });

    describe('editFile', () => {
        const editableFile = path.join(testDir, 'editable_file.txt');

        beforeEach(async () => {
            await fs.writeFile(editableFile, 'This is some content. This is unique.');
        });

        afterEach(async () => {
            try {
                await fs.unlink(editableFile);
            } catch (error) {
                // Ignore if file doesn't exist
            }
        });

        it('should edit a file by replacing unique content', async () => {
            const result = await editFile({
                filePath: getHomeRelativePath(editableFile),
                oldContent: 'some content',
                newContent: 'updated content',
            });
            expect(result.content).to.equal(`Successfully edited file at: ${editableFile}`);
            const content = await fs.readFile(editableFile, 'utf8');
            expect(content).to.equal('This is updated content. This is unique.');
        });

        it('should throw an error if oldContent is not found', async () => {
            await expect(editFile({
                filePath: getHomeRelativePath(editableFile),
                oldContent: 'non-existent content',
                newContent: 'new content',
            })).to.be.rejectedWith(/No changes made to file/);
        });

        it('should throw an error if oldContent is not unique', async () => {
            await fs.writeFile(editableFile, 'duplicate content duplicate content');
            await expect(editFile({
                filePath: getHomeRelativePath(editableFile),
                oldContent: 'duplicate content',
                newContent: 'new content',
            })).to.be.rejectedWith(/not unique/);
        });
    });

    describe('replaceString', () => {
        const replaceFile = path.join(testDir, 'replace_file.txt');

        beforeEach(async () => {
            await fs.writeFile(replaceFile, 'one two one three');
        });

        afterEach(async () => {
            try {
                await fs.unlink(replaceFile);
            } catch (error) {
                // Ignore if file doesn't exist
            }
        });

        it('should replace all occurrences of a string in a file', async () => {
            const result = await replaceString({
                filePath: getHomeRelativePath(replaceFile),
                oldString: 'one',
                newString: 'zero',
            });
            expect(result.content).to.equal(`Successfully replaced string in file at: ${replaceFile}`);
            const content = await fs.readFile(replaceFile, 'utf8');
            expect(content).to.equal('zero two zero three');
        });

        it('should not change the file if the old string is not found', async () => {
            const result = await replaceString({
                filePath: getHomeRelativePath(replaceFile),
                oldString: 'four',
                newString: 'five',
            });
            expect(result.content).to.equal(`Successfully replaced string in file at: ${replaceFile}`);
            const content = await fs.readFile(replaceFile, 'utf8');
            expect(content).to.equal('one two one three');
        });
    });

    describe('saveContentToFile', function () {
        const homeDir = os.homedir();
        const testFile = path.join('Desktop', `test_saveContentToFile_${Date.now()}.txt`);
        const testFilePath = path.join(homeDir, testFile);

        afterEach(async function () {
            // Clean up test file if it exists
            try {
                await fs.unlink(testFilePath);
            } catch (e) {}
        });

        it('should save content to a new file', async function () {
            const args = {
                filePath: testFile,
                content: 'Hello, MCP!',
            };
            const result = await saveContentToFile(args);
            expect(result.content).to.include('Successfully saved content');
            const fileContent = await fs.readFile(testFilePath, 'utf8');
            expect(fileContent).to.equal('Hello, MCP!');
        });

        it('should not overwrite an existing file by default', async function () {
            await fs.writeFile(testFilePath, 'original');
            const args = {
                filePath: testFile,
                content: 'new content',
            };
            await expect(saveContentToFile(args)).to.be.rejectedWith(/already exists/);
            const fileContent = await fs.readFile(testFilePath, 'utf8');
            expect(fileContent).to.equal('original');
        });

        it('should overwrite an existing file if overwrite is true', async function () {
            await fs.writeFile(testFilePath, 'original');
            const args = {
                filePath: testFile,
                content: 'overwritten content',
                overwrite: true,
            };
            const result = await saveContentToFile(args);
            expect(result.content).to.include('Successfully saved content');
            const fileContent = await fs.readFile(testFilePath, 'utf8');
            expect(fileContent).to.equal('overwritten content');
        });

        it('should restrict access outside the home directory', async function () {
            const args = {
                filePath: '../../outside.txt',
                content: 'bad',
            };
            await expect(saveContentToFile(args)).to.be.rejectedWith(/restricted/);
        });
    });

    describe('exportContent', function () {
        const { exportContent } = require('./server');
        const homeDir = os.homedir();
        const testText = '# Hello Export\nThis is a test.';
        const testMdFile = path.join(homeDir, 'Desktop', `test_exportContent_${Date.now()}.md`);
        const testPdfFile = path.join(homeDir, 'Desktop', `test_exportContent_${Date.now()}.pdf`);
        const testSrcFile = path.join(homeDir, 'Desktop', `test_exportContent_src_${Date.now()}.txt`);
        const testExportedMd = path.join(homeDir, 'Desktop', `test_exportContent_exported_${Date.now()}.md`);
        const testExportedPdf = path.join(homeDir, 'Desktop', `test_exportContent_exported_${Date.now()}.pdf`);

        beforeEach(async function () {
            // Create a source file for file export tests
            await fs.writeFile(testSrcFile, testText);
        });

        afterEach(async function () {
            // Clean up all test files
            for (const file of [testMdFile, testPdfFile, testSrcFile, testExportedMd, testExportedPdf]) {
                try { await fs.unlink(file); } catch (e) {}
            }
        });

        it('should export text content as Markdown', async function () {
            const args = {
                sourceType: 'text',
                source: testText,
                format: 'md',
                outputPath: testMdFile.replace(homeDir + path.sep, ''),
            };
            const result = await exportContent(args);
            expect(result.content).to.include('Successfully exported');
            const exported = await fs.readFile(testMdFile, 'utf8');
            expect(exported).to.equal(testText);
        });

        it('should export text content as PDF', async function () {
            this.timeout(10000); // 10 seconds
            const args = {
                sourceType: 'text',
                source: testText,
                format: 'pdf',
                outputPath: testPdfFile.replace(homeDir + path.sep, ''),
            };
            const result = await exportContent(args);
            expect(result.content).to.include('Successfully exported');
            // Check that the PDF file exists and is not empty
            const stat = await fs.stat(testPdfFile);
            expect(stat.size).to.be.greaterThan(100); // PDF should not be empty
        });

        it('should export a file as Markdown', async function () {
            const args = {
                sourceType: 'file',
                source: testSrcFile.replace(homeDir + path.sep, ''),
                format: 'md',
                outputPath: testExportedMd.replace(homeDir + path.sep, ''),
            };
            const result = await exportContent(args);
            expect(result.content).to.include('Successfully exported');
            const exported = await fs.readFile(testExportedMd, 'utf8');
            expect(exported).to.equal(testText);
        });

        it('should export a file as PDF', async function () {
            const args = {
                sourceType: 'file',
                source: testSrcFile.replace(homeDir + path.sep, ''),
                format: 'pdf',
                outputPath: testExportedPdf.replace(homeDir + path.sep, ''),
            };
            const result = await exportContent(args);
            expect(result.content).to.include('Successfully exported');
            const stat = await fs.stat(testExportedPdf);
            expect(stat.size).to.be.greaterThan(100);
        });

        it('should throw an error for invalid format', async function () {
            const args = {
                sourceType: 'text',
                source: testText,
                format: 'docx',
                outputPath: testMdFile.replace(homeDir + path.sep, ''),
            };
            await expect(exportContent(args)).to.be.rejectedWith(/invalid|unsupported/i);
        });

        it('should throw an error for invalid sourceType', async function () {
            const args = {
                sourceType: 'blob',
                source: testText,
                format: 'md',
                outputPath: testMdFile.replace(homeDir + path.sep, ''),
            };
            await expect(exportContent(args)).to.be.rejectedWith(/invalid|unsupported/i);
        });

        it('should restrict export outside the home directory', async function () {
            const args = {
                sourceType: 'text',
                source: testText,
                format: 'md',
                outputPath: '../../outside.md',
            };
            await expect(exportContent(args)).to.be.rejectedWith(/restricted|not allowed|outside|invalid/i);
        });
    });

});

describe('Directory Operations', function () {
    const homeDir = os.homedir();
    const baseDir = path.join(homeDir, 'test_dir_ops');
    const subDir = path.join(baseDir, 'subdir');
    const movedDir = path.join(homeDir, 'test_dir_ops_moved');
    const renamedDir = path.join(homeDir, 'test_dir_ops_renamed');

    beforeEach(async function () {
        await fs.mkdir(baseDir, { recursive: true });
    });

    afterEach(async function () {
        for (const dir of [baseDir, movedDir, renamedDir]) {
            try { await fs.rm(dir, { recursive: true, force: true }); } catch (e) {}
        }
    });

    it('should create a new directory', async function () {
        const result = await createDirectory({ directoryPath: getHomeRelativePath(subDir) });
        expect(result.content).to.include('Successfully created directory');
        const stat = await fs.stat(subDir);
        expect(stat.isDirectory()).to.be.true;
    });

    it('should not create a directory outside the home directory', async function () {
        await expect(createDirectory({ directoryPath: '../../outside_dir' }))
            .to.be.rejectedWith(/restricted|not allowed|outside|invalid/i);
    });

    it('should delete a directory', async function () {
        await fs.mkdir(subDir, { recursive: true });
        const result = await deleteDirectory({ directoryPath: getHomeRelativePath(subDir) });
        expect(result.content).to.include('Successfully deleted directory');
        await expect(fs.stat(subDir)).to.be.rejectedWith(/ENOENT/);
    });

    it('should not delete a directory outside the home directory', async function () {
        await expect(deleteDirectory({ directoryPath: '../../outside_dir' }))
            .to.be.rejectedWith(/restricted|not allowed|outside|invalid/i);
    });

    it('should rename a directory', async function () {
        await fs.mkdir(subDir, { recursive: true });
        const result = await renameDirectory({
            oldPath: getHomeRelativePath(subDir),
            newPath: getHomeRelativePath(renamedDir)
        });
        expect(result.content).to.include('Successfully renamed directory');
        const stat = await fs.stat(renamedDir);
        expect(stat.isDirectory()).to.be.true;
    });

    it('should move a directory', async function () {
        await fs.mkdir(subDir, { recursive: true });
        const result = await moveDirectory({
            sourcePath: getHomeRelativePath(subDir),
            destinationPath: getHomeRelativePath(movedDir)
        });
        expect(result.content).to.include('Successfully moved directory');
        const stat = await fs.stat(movedDir);
        expect(stat.isDirectory()).to.be.true;
    });

    it('should not move a directory outside the home directory', async function () {
        await fs.mkdir(subDir, { recursive: true });
        await expect(moveDirectory({
            sourcePath: getHomeRelativePath(subDir),
            destinationPath: '../../outside_dir'
        })).to.be.rejectedWith(/restricted|not allowed|outside|invalid/i);
    });

    it('should handle deleting a non-existent directory gracefully', async function () {
        await deleteDirectory({ directoryPath: getHomeRelativePath(path.join(baseDir, 'does_not_exist')) });
        await expect(fs.stat(path.join(baseDir, 'does_not_exist'))).to.be.rejectedWith(/ENOENT/);
    });
});

function getHomeRelativePath(absPath) {
  const home = os.homedir();
  if (absPath.startsWith(home)) {
    return absPath.slice(home.length + 1);
  }
  return absPath;
}