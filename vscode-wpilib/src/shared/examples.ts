'use strict';
import { readFile } from 'fs/promises';
import * as toml from 'toml';
import * as path from 'path';
import * as vscode from 'vscode';
import { IExampleTemplateAPI, IExampleTemplateCreator } from '../api';
import { localize as i18n } from '../locale';
import { logger } from '../logger';
import { generateCopyCpp, generateCopyJava } from './generator';

export interface IExampleToml {
  examples: IExampleTomlLayout[];
}

export interface IExampleTomlLayout {
  name: string;
  description: string;
  tags: string[];
  foldername: string;
  gradlebase: string;
  robotclass: string;
  commandversion: number;
  extravendordeps?: string[];
  hasunittests?: boolean;
}

const exampleResourceName = 'examples.toml';

export async function registerExamples(
  resourceRoot: string,
  java: boolean,
  core: IExampleTemplateAPI
) {
  const examplesFolder = path.join(resourceRoot, 'src', 'examples');
  const examplesTestFolder = path.join(resourceRoot, 'src', 'examples_test');
  const resourceFile = path.join(examplesFolder, exampleResourceName);
  const gradleBasePath = path.join(path.dirname(resourceRoot), 'gradle');
  try {
    const data = await readFile(resourceFile, 'utf8');
    const examples: IExampleToml = toml.parse(data) as IExampleToml;
    for (const e of examples.examples) {
      const vendordeps: string[] = e.extravendordeps ?? [];
      const commandVersion: string = e.commandversion ? e.commandversion.toString() : '2';
      if (commandVersion === '3') {
        vendordeps.push('commandsv3');
      } else {
        vendordeps.push('commandsv2');
      }
      const provider: IExampleTemplateCreator = {
        getLanguage(): string {
          return java ? 'java' : 'cpp';
        },
        getDescription(): string {
          return e.description;
        },
        getDisplayName(): string {
          return e.name;
        },
        async generate(folderInto: vscode.Uri): Promise<boolean> {
          try {
            let testFolder;
            if (e.hasunittests) {
              testFolder = path.join(examplesTestFolder, e.foldername);
            }
            if (java) {
              const mainJavaFile = path.join(resourceRoot, 'src', 'Main.java');
              if (
                !(await generateCopyJava(
                  resourceRoot,
                  path.join(examplesFolder, e.foldername),
                  testFolder,
                  path.join(gradleBasePath, e.gradlebase),
                  folderInto.fsPath,
                  mainJavaFile,
                  'first.robot.' + e.robotclass,
                  path.join('first', 'robot'),
                  false,
                  vendordeps
                ))
              ) {
                vscode.window.showErrorMessage(
                  i18n('message', 'Cannot create into non empty folder')
                );
                return false;
              }
            } else {
              if (
                !(await generateCopyCpp(
                  resourceRoot,
                  path.join(examplesFolder, e.foldername),
                  testFolder,
                  path.join(gradleBasePath, e.gradlebase),
                  folderInto.fsPath,
                  false,
                  vendordeps
                ))
              ) {
                vscode.window.showErrorMessage(
                  i18n('message', 'Cannot create into non empty folder')
                );
                return false;
              }
            }
          } catch (err) {
            logger.error('Example generation error: ', err);
            return false;
          }
          return true;
        },
      };
      core.addExampleProvider(provider);
    }
  } catch (err) {
    logger.log('Example error: ', err);
  }
}
