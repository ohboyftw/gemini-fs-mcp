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

});