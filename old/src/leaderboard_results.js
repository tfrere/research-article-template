import Papa from 'papaparse';
import { DataTable } from 'simple-datatables';

const languageMap = {
  'All Languages': 'final_rankings.csv',
  'Arabic': 'results_ar.csv',
  'Turkish': 'results_tr.csv',
  'Swahili': 'results_sw.csv',
  'Russian': 'results_ru.csv',
  'Telugu': 'results_te.csv',
  'Thai': 'results_th.csv',
  'Chinese': 'results_zh.csv',
  'French': 'results_fr.csv',
  'Hindi': 'results_hi.csv',
};

const versionMap = {
  'v1': 'v1',
  'v2': 'v2'
};

const versionChangelog = {
  'v1': 'Initial release of FineTasks Leaderboard',
  'v2': 'Changes in v2:\n' +
        '• Fixed a bug in the rescaling of scores\n' +
        '• Switched to using Native choice prefixes for Thai/Telugu/Hindi/Arabics\n' +
        '• Added Options: anchors before showing options for continuation tasks (e.g Hellawag) - consistent improvement in scores\n' +
        '• Removed openai/gpt-4o-mini'
};

const columnNameMap = {
  'runname': 'Model',
  'agg_score_macro': 'Score',
  'agg_score_RES': 'RES Score',
  'agg_score_RC': 'RC Score',
  'agg_score_GK': 'GK Score',
  'agg_score_NLU': 'NLU Score',
  'avg_rank_macro': 'Multilingual Score',
  'rank': 'Rank'
};

function createDropdown(options, onChange, initialValue = null) {
  const select = document.createElement('select');
  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    optionElement.textContent = option;
    if (initialValue && option === initialValue) {
      optionElement.selected = true;
    }
    select.appendChild(optionElement);
  });
  select.addEventListener('change', onChange);
  return select;
}

function processTaskName(taskName) {
  const parts = taskName.split('|');
  let processedName = parts.length > 1 ? parts[1] : taskName;
  processedName = processedName.split('_mcf')[0].split('_cf')[0];
  return processedName;
}

function sanitizeColumnName(name) {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_');
}

function createResultsTable(data, extraColumn) {
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-wrapper leaderboard-table-wrapper';

  const table = document.createElement('table');
  table.className = 'results-table leaderboard-results-table';

  const columns = extraColumn === 'All Languages' 
    ? ['rank', 'runname', 'avg_rank_macro']
    : ['rank', 'runname', 'agg_score_macro', extraColumn].filter(Boolean);

  const header = table.createTHead();
  const headerRow = header.insertRow();
  columns.forEach(column => {
    const th = document.createElement('th');
    th.textContent = columnNameMap[column] || processTaskName(column);
    th.className = `column-${sanitizeColumnName(column)}`; // Sanitize the column name
    headerRow.appendChild(th);
  });

  const body = table.createTBody();
  data.forEach((row, index) => {
    if (!row.runname) return; // Skip rows without a model name
    const tr = body.insertRow();
    
    // Add gradient background for top 3 positions
    if (index < 3) {
      const opacity = 1 - (index * 0.25); // Creates a fading effect: 1, 0.75, 0.5
      tr.style.backgroundColor = `rgba(255, 165, 0, ${opacity * 0.2})`; // Light orange with fading opacity
      tr.style.fontWeight = 600; // Make text slightly bolder for top 3
    }

    columns.forEach(column => {
      const td = tr.insertCell();
      td.className = `column-${sanitizeColumnName(column)}`;
      
      if (column === 'rank') {
        td.textContent = index + 1;
        // Add special styling for top 3 ranks
        if (index < 3) {
          td.style.fontWeight = 'bold';
          switch(index) {
            case 0:
              td.style.color = '#FFB800'; // Gold
              break;
            case 1:
              td.style.color = '#C0C0C0'; // Silver
              break;
            case 2:
              td.style.color = '#CD7F32'; // Bronze
              break;
          }
        }
      } else if (column === 'runname') {
        const modelName = row[column];
        let displayName;
        
        // Check if it's a chat model
        const chatModels = [
          'CohereForAI/c4ai-command-r-plus-08-2024',
          'openai/gpt-4o-mini',
          'silma-ai/SILMA-9B-Instruct-v1.0',
          'microsoft/Phi-3.5-mini-instruct',
          'TURKCELL/Turkcell-LLM-7b-v1'
        ];
        
        if (chatModels.some(chatModel => modelName.includes(chatModel))) {
          displayName = `💬 ${modelName}`;
        } else {
          displayName = `🟢 ${modelName}`;
        }

        if (modelName.split("/")[0] !== "openai")
          displayName = `<a href="https://huggingface.co/${modelName}">${displayName}</a>`;
        td.innerHTML = displayName;
        td.title = modelName; // Add full model name as tooltip
        td.style.cursor = 'help'; // Change cursor to indicate hover functionality
      } else {
        const value = row[column];
        td.textContent = typeof value === 'number' ? value.toFixed(2) : value;
      }
    });
  });

  tableWrapper.appendChild(table);
  return tableWrapper;
}

function createChangelog() {
  const changelogContainer = document.createElement('div');
  changelogContainer.className = 'changelog-container';

  const changelogHeader = document.createElement('div');
  changelogHeader.className = 'changelog-header';
  
  const arrow = document.createElement('span');
  arrow.className = 'changelog-arrow';
  arrow.textContent = '▶';
  
  const label = document.createElement('span');
  label.textContent = 'Changelog';
  label.className = 'changelog-label';

  const content = document.createElement('div');
  content.className = 'changelog-content';
  content.style.display = 'none';

  changelogHeader.appendChild(arrow);
  changelogHeader.appendChild(label);
  changelogContainer.appendChild(changelogHeader);
  changelogContainer.appendChild(content);

  // Toggle changelog visibility
  changelogHeader.addEventListener('click', () => {
    const isVisible = content.style.display !== 'none';
    content.style.display = isVisible ? 'none' : 'block';
    arrow.textContent = isVisible ? '▶' : '▼';
  });

  return { container: changelogContainer, content };
}

export function initLeaderboardResults(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const titleElement = document.createElement('h3');
  titleElement.textContent = 'FineTasks Leaderboard';
  titleElement.className = 'leaderboard-title';

  // Create changelog
  const { container: changelogContainer, content: changelogContent } = createChangelog();

  const tableContainer = document.createElement('div');
  tableContainer.className = 'table-container';
  
  let leaderboardDataTable;
  let currentData = [];

  // Create caption element
  const captionElement = document.createElement('figcaption');
  captionElement.className = 'table-caption';
  captionElement.textContent = container.dataset.caption || '';

  // Define update functions first
  async function updateLanguageTable() {
    const selectedVersion = versionDropdown.value;
    const selectedLanguage = languageDropdown.value;
    const csvFile = languageMap[selectedLanguage];

    try {
      const response = await fetch(`data/os_models/${selectedVersion}/${csvFile}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const csvText = await response.text();
      const results = Papa.parse(csvText, { header: true, dynamicTyping: true }).data;
      currentData = selectedLanguage === 'All Languages'
        ? results.sort((a, b) => a.avg_rank_macro - b.avg_rank_macro)
        : results.sort((a, b) => b.agg_score_macro - a.agg_score_macro);

      if (selectedLanguage !== 'All Languages') {
        const columnOptions = ['None'].concat(Object.keys(currentData[0]).filter(key => 
          !['runname', 'seed', 'steps', 'agg_score_micro', 'rank', 'avg_rank_macro', ''].includes(key)
        ));
        extraColumnDropdown.innerHTML = '';
        columnOptions.forEach(option => {
          const optionElement = document.createElement('option');
          optionElement.value = option;
          optionElement.textContent = option === 'None' ? 'None' : processTaskName(option);
          extraColumnDropdown.appendChild(optionElement);
        });
        
        extraColumnDropdown.value = 'None';
        extraColumnLabel.style.display = 'inline';
        extraColumnDropdown.style.display = 'inline';
      } else {
        extraColumnLabel.style.display = 'none';
        extraColumnDropdown.style.display = 'none';
      }

      updateTable();
      updateChangelog();
    } catch (error) {
      console.error('Error fetching CSV:', error);
      tableContainer.innerHTML = `<p>Error loading data: ${error.message}</p>`;
    }
  }

  function updateTable() {
    const extraColumn = languageDropdown.value === 'All Languages' ? 'All Languages' : 
                       (extraColumnDropdown.value === 'None' ? null : extraColumnDropdown.value);
    
    tableContainer.innerHTML = '';
    const tableWrapper = createResultsTable(currentData, extraColumn);
    tableContainer.appendChild(tableWrapper);

    if (leaderboardDataTable) {
      leaderboardDataTable.destroy();
    }

    leaderboardDataTable = new DataTable('.leaderboard-results-table', {
      perPage: 10,
      perPageSelect: false,
      searchable: false,
      sortable: true,
      fixedHeight: true,
      labels: {
        info: ''
      }
    });

    setTimeout(adjustColumnWidths, 0);
  }

  function updateChangelog() {
    const selectedVersion = versionDropdown.value;
    changelogContent.textContent = versionChangelog[selectedVersion];
  }

  // Add this function to get URL parameters
  function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  // Add this function to set URL parameters
  function updateUrlParameter(key, value) {
    const urlParams = new URLSearchParams(window.location.search);
    if (value) {
      urlParams.set(key, value);
    } else {
      urlParams.delete(key);
    }
    const newUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  }

  // Get initial language from URL
  const urlLanguage = getUrlParameter('language');
  const initialLanguage = urlLanguage && Object.keys(languageMap).includes(urlLanguage) 
    ? urlLanguage 
    : 'All Languages';

  // Create dropdowns with initial values
  const languageLabel = document.createElement('label');
  languageLabel.textContent = 'Language: ';
  const languageDropdown = createDropdown(
    Object.keys(languageMap), 
    (e) => {
      updateLanguageTable();
      updateUrlParameter('language', e.target.value === 'All Languages' ? null : e.target.value);
    }, 
    initialLanguage
  );

  const extraColumnLabel = document.createElement('label');
  extraColumnLabel.textContent = 'Task: ';
  const extraColumnDropdown = createDropdown(['None'], updateTable);

  const versionLabel = document.createElement('label');
  versionLabel.textContent = 'Version: ';
  const versionDropdown = createDropdown(Object.keys(versionMap), updateLanguageTable);

  // Create controls
  const controls = document.createElement('div');
  controls.className = 'controls leaderboard-controls fine-tasks-controls';

  const versionControlGroup = document.createElement('div');
  versionControlGroup.className = 'control-group';
  versionControlGroup.appendChild(versionLabel);
  versionControlGroup.appendChild(versionDropdown);

  const languageControlGroup = document.createElement('div');
  languageControlGroup.className = 'control-group';
  languageControlGroup.appendChild(languageLabel);
  languageControlGroup.appendChild(languageDropdown);

  const extraColumnControlGroup = document.createElement('div');
  extraColumnControlGroup.className = 'control-group';
  extraColumnControlGroup.appendChild(extraColumnLabel);
  extraColumnControlGroup.appendChild(extraColumnDropdown);

  controls.appendChild(versionControlGroup);
  controls.appendChild(languageControlGroup);
  controls.appendChild(extraColumnControlGroup);

  // Add elements to container in new order
  container.appendChild(titleElement);
  container.appendChild(tableContainer);
  container.appendChild(captionElement);
  container.appendChild(controls);
  container.appendChild(changelogContainer);

  // Initialize with URL language if present
  versionDropdown.value = 'v2';
  languageDropdown.value = initialLanguage;
  updateLanguageTable();
}

function adjustColumnWidths() {
  const table = document.querySelector('.leaderboard-results-table');
  if (!table) return;

  const columns = table.querySelectorAll('th');
  columns.forEach((column, index) => {
    const columnClass = column.className;
    const cells = table.querySelectorAll(`td.${columnClass}`);
    let maxWidth = column.offsetWidth;
    cells.forEach(cell => {
      maxWidth = Math.max(maxWidth, cell.offsetWidth);
    });

    let adjustedWidth;
    if (index === 0) { // Rank column
      adjustedWidth = 50;
    } else if (index === 1) { // Model name column
      adjustedWidth = 200;
    } else if (index === 2) { // Macro score column
      adjustedWidth = 100;
    } else { // Extra column or any other column
      adjustedWidth = Math.min(maxWidth, 150); // Set a maximum width of 150px for other columns
    }

    column.style.width = `${adjustedWidth}px`;
    cells.forEach(cell => {
      cell.style.width = `${adjustedWidth}px`;
    });
  });
}
