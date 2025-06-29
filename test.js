const { expect } = require('chai');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const { saveContentToFile } = require('./server');
const { listFiles, readFile, createFile, editFile, replaceString, deleteFile, deleteDirectory, renameFile, renameDirectory, moveFile, moveDirectory, createDirectory, getFileInfo, getDirectoryInfo, appendToFile, prependToFile, searchInFile, zipDirectory, unzipFile, changePermissions, listRecentFiles, searchFiles } = require('./server.js');

// Helper to get a path relative to the home directory
const getHomeRelativePath = (p) => path.relative(os.homedir(), p);

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
            try {
                await readFile({ filePath: getHomeRelativePath(path.join(testDir, 'non_existent_file.txt')) });
                expect.fail('readFile did not throw an error for a non-existent file');
            } catch (error) {
                expect(error.message).to.include('ENOENT');
            }
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
            try {
                await createFile({ filePath: getHomeRelativePath(newFile), content: 'New content' });
                expect.fail('createFile did not throw an error for an existing file');
            } catch (error) {
                expect(error.message).to.include('File already exists');
            }
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
            try {
                await editFile({
                    filePath: getHomeRelativePath(editableFile),
                    oldContent: 'non-existent content',
                    newContent: 'new content',
                });
                expect.fail('editFile did not throw an error for non-existent oldContent');
            } catch (error) {
                expect(error.message).to.include('No changes made to file');
            }
        });

        it('should throw an error if oldContent is not unique', async () => {
            await fs.writeFile(editableFile, 'duplicate content duplicate content');
            try {
                await editFile({
                    filePath: getHomeRelativePath(editableFile),
                    oldContent: 'duplicate content',
                    newContent: 'new content',
                });
                expect.fail('editFile did not throw an error for non-unique oldContent');
            } catch (error) {
                expect(error.message).to.include('not unique');
            }
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
            try {
                await saveContentToFile(args);
                throw new Error('Expected error for existing file');
            } catch (err) {
                expect(err.message).to.include('already exists');
            }
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
            try {
                await saveContentToFile(args);
                throw new Error('Expected error for restricted access');
            } catch (err) {
                expect(err.message).to.include('restricted');
            }
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
            try {
                await exportContent(args);
                throw new Error('Expected error for invalid format');
            } catch (err) {
                expect(err.message).to.match(/invalid|unsupported/i);
            }
        });

        it('should throw an error for invalid sourceType', async function () {
            const args = {
                sourceType: 'blob',
                source: testText,
                format: 'md',
                outputPath: testMdFile.replace(homeDir + path.sep, ''),
            };
            try {
                await exportContent(args);
                throw new Error('Expected error for invalid sourceType');
            } catch (err) {
                expect(err.message).to.match(/invalid|unsupported/i);
            }
        });

        it('should restrict export outside the home directory', async function () {
            const args = {
                sourceType: 'text',
                source: testText,
                format: 'md',
                outputPath: '../../outside.md',
            };
            try {
                await exportContent(args);
                throw new Error('Expected error for restricted path');
            } catch (err) {
                expect(err.message).to.match(/restricted|not allowed|outside|invalid/i);
            }
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
        try {
            await createDirectory({ directoryPath: '../../outside_dir' });
            throw new Error('Expected error for restricted access');
        } catch (err) {
            expect(err.message).to.match(/restricted|not allowed|outside|invalid/i);
        }
    });

    it('should delete a directory', async function () {
        await fs.mkdir(subDir, { recursive: true });
        const result = await deleteDirectory({ directoryPath: getHomeRelativePath(subDir) });
        expect(result.content).to.include('Successfully deleted directory');
        try {
            await fs.stat(subDir);
            throw new Error('Directory still exists');
        } catch (err) {
            expect(err.code).to.equal('ENOENT');
        }
    });

    it('should not delete a directory outside the home directory', async function () {
        try {
            await deleteDirectory({ directoryPath: '../../outside_dir' });
            throw new Error('Expected error for restricted access');
        } catch (err) {
            expect(err.message).to.match(/restricted|not allowed|outside|invalid/i);
        }
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
        try {
            await moveDirectory({
                sourcePath: getHomeRelativePath(subDir),
                destinationPath: '../../outside_dir'
            });
            throw new Error('Expected error for restricted access');
        } catch (err) {
            expect(err.message).to.match(/restricted|not allowed|outside|invalid/i);
        }
    });

    it('should handle deleting a non-existent directory gracefully', async function () {
        await deleteDirectory({ directoryPath: getHomeRelativePath(path.join(baseDir, 'does_not_exist')) });
        try {
            await fs.stat(path.join(baseDir, 'does_not_exist'));
            throw new Error('Directory still exists');
        } catch (err) {
            expect(err.code).to.equal('ENOENT');
        }
    });
});