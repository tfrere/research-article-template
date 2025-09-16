/**
 * Configuration et mappings pour la conversion LaTeX vers Markdown
 */

export const COMMAND_MAPPINGS = {
    // Math shortcuts
    'X': '\\mathcal{X}',
    'Z': '\\mathcal{Z}',
    'G': '\\mathcal{G}',
    'D': '\\mathcal{D}',
    'F': '\\mathcal{F}',
    'R': '\\mathcal{R}',

    // Text commands
    'eg': 'e.g.,',
    'ie': 'i.e.,',
    'versus': 'vs.',
    'wrt': 'w.r.t.',
    'etc': 'etc.',

    // Project-specific
    'lerobot': '**LeRobot**',
    'lerobotdataset': '`LeRobotDataset`',
    'huggingface': '🤗 **Hugging Face**',

    // Functions
    'qfunction': 'Q-function',
    'qopt': 'Q^*'
};

export const ENVIRONMENT_MAPPINGS = {
    'tldr': {
        start: '> **TL;DR**\n> ',
        end: '\n',
        type: 'callout'
    },
    'callout': {
        start: '> **Note**\n> ',
        end: '\n',
        type: 'callout'
    },
    'finding': {
        start: '> **🔍 Finding**: ',
        end: '\n',
        type: 'finding'
    }
};

export const PANDOC_OPTIONS = [
    '--from=latex',
    '--to=markdown',
    '--wrap=preserve',
    '--markdown-headings=atx'
];

export const DEFAULT_PATHS = {
    input: '../tools/latex-to-markdown/input',
    output: 'src/content'
};
