import fs from 'node:fs/promises'
import fsPath from 'node:path'
import { isEmpty } from '@activepieces/shared'
import { enrichErrorContext } from './exception-handler'
import { exec } from './exec'
import { fileExists } from './file-system'
import { logger } from './logger'
import { memoryLock } from './memory-lock'

type PackageManagerOutput = {
    stdout: string
    stderr: string
}

type CoreCommand = 'install' | 'init' | 'link'
type ExecCommand = 'npx tsc'
type Command = CoreCommand | ExecCommand

export type PackageInfo = {
    /**
   * name or alias
   */
    alias: string

    /**
   * where to get the package from, could be an npm tag, a local path, or a tarball.
   */
    spec: string
}

const runCommand = async (
    path: string,
    command: Command,
    ...args: string[]
): Promise<PackageManagerOutput> => {
    try {
        logger.debug({ path, command, args }, '[PackageManager#execute]')

        const commandLine = command.startsWith('npx') 
            ? `${command} ${args.join(' ')}`
            : `npm ${command} ${args.join(' ')}`
            
        return await exec(commandLine, { cwd: path })
    }
    catch (error) {
        const contextKey = '[PackageManager#runCommand]'
        const contextValue = { path, command, args }

        const enrichedError = enrichErrorContext({
            error,
            key: contextKey,
            value: contextValue,
        })

        throw enrichedError
    }
}

export const packageManager = {
    async add({ path, dependencies }: AddParams): Promise<PackageManagerOutput> {
        if (isEmpty(dependencies)) {
            return {
                stdout: '',
                stderr: '',
            }
        }

        const config = [
            '--prefer-offline',
            '--ignore-scripts',
            '--no-package-lock',
            '--legacy-peer-deps',
        ]

        const dependencyArgs = dependencies.map((d) => `${d.alias}@${d.spec}`)
        return runCommand(path, 'install', ...dependencyArgs, ...config)
    },

    async init({ path }: InitParams): Promise<PackageManagerOutput> {
        const lock = await memoryLock.acquire(`npm-init-${path}`)
        try {
            const fExists = await fileExists(fsPath.join(path, 'package.json'))
            if (fExists) {
                return {
                    stdout: 'N/A',
                    stderr: 'N/A',
                }
            }
            // It must be awaited so it only releases the lock after the command is done
            const result = await runCommand(path, 'init', '-y')
            return result
        }
        finally {
            await lock.release()
        }
    },

    async exec({ path, command }: ExecParams): Promise<PackageManagerOutput> {
        return runCommand(path, command)
    },

    async link({
        path,
        linkPath,
        packageName,
    }: LinkParams): Promise<PackageManagerOutput> {
        const config = [
            '--no-package-lock',
            '--legacy-peer-deps',
        ]

        const result = await runCommand(path, 'link', linkPath, ...config)

        const nodeModules = fsPath.join(path, 'node_modules', packageName)
        await replaceRelativeSystemLinkWithAbsolute(nodeModules)
        return result
    },
}

const replaceRelativeSystemLinkWithAbsolute = async (filePath: string) => {
    try {
        // Inside the isolate sandbox, the relative path is not valid

        const stats = await fs.stat(filePath)

        if (stats.isDirectory()) {
            const realPath = await fs.realpath(filePath)
            logger.info({ realPath, filePath }, '[link]')
            await fs.unlink(filePath)
            await fs.symlink(realPath, filePath, 'junction')
        }
    }
    catch (error) {
        logger.error([error], '[link]')
    }
}

type AddParams = {
    path: string
    dependencies: PackageInfo[]
}

type InitParams = {
    path: string
}

type ExecParams = {
    path: string
    command: ExecCommand
}

type LinkParams = {
    path: string
    linkPath: string
    packageName: string
}
