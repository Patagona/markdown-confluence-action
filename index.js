const core = require('@actions/core');
const github = require('@actions/github');
const tool_cache = require('@actions/tool-cache');
const exec = require('@actions/exec');
const fs = require('fs');

const user = core.getInput('confluence_user', {required: true})
const password = core.getInput('confluence_password', {required: true})
const url = core.getInput('confluence_url', {required: true})
const space = core.getInput('confluence_space', {required: true})
const repo_url = core.getInput('repository_url', {required: true})
const global_title = core.getInput('confluence_title', {required: true})


async function upload_dir(dir, parent) {
  const content = fs.readdirSync(dir, {withFileTypes: true});
  content.forEach(async dir_entry => {
    if (dir_entry.isFile()){
      await upload_extend_file(`${dir}/${dir_entry.name}`, title_from_file(dir_entry.name), parent);
      const child_path = `${dir}/${dir_entry.name}.d`;
      if (fs.statSync(child_path, {throwIfNoEntry: false})) {
        await upload_dir(child_path, title_from_file(dir_entry.name));
      }
    }
  });
}

function title_from_file(file) {
  return file.replace('.md', '').replace("-", " ")
}

async function upload_extend_file(file, title, parent) {
  let tmp_file_name = file + ".tmp";
  let original_content = fs.readFileSync(file);
  let title_line = `<!-- Title: ${title} -->\n`;
  let parent_line = undefined;
  if (parent) {
     parent_line = `<!-- Parent: ${parent} -->\n`
  } else {
    parent_line = ''
  }
  
  let file_content = `${title_line}${parent_line}${original_content}\n\n **NOTE**: this document is generated, do not edit manually. Instead open a pull request in the [repository](${repo_url}).`
  console.log(file_content)
  fs.writeFileSync(tmp_file_name, file_content);
  await exec.exec('mark',  ['--space', space, '-u', user, '-p', password, '-b', url, '-f', tmp_file_name]);
}


async function main() {
  const mark_tar = await tool_cache.downloadTool('https://github.com/kovetskiy/mark/releases/download/8.1/mark_8.1_Linux_x86_64.tar.gz');
  const mark_dir = await tool_cache.extractTar(mark_tar, 'mark_dir');
  const cached_dir = await tool_cache.cacheDir(mark_dir, 'mark', '8.1');


  core.addPath(cached_dir);
  
  await upload_extend_file('README.md', global_title);

  await upload_dir('doc');
}

main().then(_ => {}).catch(err => {console.log(err)})

