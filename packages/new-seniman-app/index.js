#!/usr/bin/env node

import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import fsExtra from 'fs-extra';
import { fileURLToPath } from 'url';

// list of available project templates from folders available in app-templates

let projectTemplateNames = await fs.promises.readdir(path.dirname(fileURLToPath(new URL(import.meta.url))) + '/app-templates');

inquirer.prompt([
  {
    type: "list",
    name: 'projectTemplate',
    message: "Which project template would you like to use?",
    default: "hello-world",
    choices: projectTemplateNames
  },
  {
    name: 'projectName',
    message: 'What is the name of your app?'
  }
]).then(async answers => {
  const projectTemplate = answers.projectTemplate;
  const appName = answers.projectName;

  console.log('Creating application', appName);
  const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)));

  await fsExtra.copy(__dirname + `/app-templates/${projectTemplate}`, process.cwd() + '/' + appName);

  let packageJsonStringTemplate = await fs.promises.readFile(process.cwd() + '/' + appName + '/package.json', 'utf-8');
  let packageJsonString = packageJsonStringTemplate.replace('$APP_NAME', appName);

  await fs.promises.writeFile(process.cwd() + '/' + appName + '/package.json', packageJsonString);

  console.log('Created!');
});