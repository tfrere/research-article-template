import Papa from 'papaparse';
import { DataTable } from 'simple-datatables';

const languageMap = {
  'Arabic': 'ar',
  'Turkish': 'tr',
  'Swahili': 'sw',
  'Russian': 'ru',
  'Telugu': 'te',
  'Thai': 'th',
  'Chinese': 'zh',
  'French': 'fr',
  'Hindi': 'hi',
};

const metricTypes = [
  { value: 'max_score', label: 'Max Score' },
  { value: 'avg_snr', label: 'Low Noise' },
  { value: 'avg_spearman', label: 'Monotonicity' },
  { value: 'max_n_std', label: 'Non-Randomness' },
  { value: 'avg_kendall_tau_a', label: 'Ordering Consistency' }
];

const tableTypes = [
  { value: 'gen', label: 'Generative' },
  { value: 'mc', label: 'Multichoice' }
];

const taskFolders = [
  { value: 'selected', label: 'FineTasks' },
  { value: 'non_selected', label: 'Non-Selected' }
];

function createDropdown(options, onChange) {
  const select = document.createElement('select');
  options.forEach(option => {
    const optionElement = document.createElement('option');
    if (typeof option === 'object' && option.value && option.label) {
      optionElement.value = option.value;
      optionElement.textContent = option.label;
    } else {
      optionElement.value = option;
      optionElement.textContent = option;
    }
    select.appendChild(optionElement);
  });
  select.addEventListener('change', onChange);
  return select;
}

function createPerTaskResultsTable(data, tableType, metric) {
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-wrapper fine-tasks-table-wrapper';

  const table = document.createElement('table');
  table.className = 'results-table fine-tasks-results-table';

  const columns = ['Task', 'Type', ...(tableType === 'gen' ? ['f1', 'prefix_match'] : ['acc', 'acc_norm', 'acc_norm_token', 'acc_norm_pmi'])];
  
  const columnNameMap = {
    // 'Task': 'Task',
    // 'Type': 'Type',
    // 'f1': 'f1',
    // 'prefix_match': 'prefix_match',
    // 'acc': 'acc',
    'acc_norm': 'acc_char',
    'acc_norm_token': 'acc_token',
    'acc_norm_pmi': 'acc_pmi',
    'prefix_match': 'prefix'
  };

  const taskMetricMap = {
    'max_score': 'score',
    'avg_snr': 'snr',
    'avg_spearman': 'monotonicity',
    'max_n_std': 'non-randomness',
    'avg_kendall_tau_a': 'ordering'
    // 'avg_spearman': 'monotonicity',
  }

  const header = table.createTHead();
  const headerRow = header.insertRow();
  columns.forEach(column => {
    const th = document.createElement('th');
    th.textContent = columnNameMap[column] || column;

    if (th.textContent !== "Task" && th.textContent !== "Type") {
        th.textContent += " " + (taskMetricMap[metric] || metric);
    }
    th.title = th.textContent;
    if (column === 'Type')
      th.style.width = '40px';
    headerRow.appendChild(th);
  });

  const body = table.createTBody();
  data.forEach(row => {
    if (Object.values(row).every(value => value === '' || value === undefined || value === null)) {
      return;
    }
    
    const tr = body.insertRow();
    columns.forEach(column => {
      const td = tr.insertCell();
      let value = row[column];
      if (column === 'Task') {
        const fullTaskName = value; // Store the full task name
        const parts = value.split('|');
        value = parts.length > 1 ? parts[1] : value;
        value = value.split('_mcf')[0].split('_cf')[0];
        td.title = fullTaskName; // Set the title attribute to show the full name on hover
      } else if (column === 'Type') {
        // Keep the task type as is
      } else if (typeof value === 'number') {
        value = value.toFixed(2);
      } else if (value && !isNaN(parseFloat(value))) {
        value = parseFloat(value).toFixed(2);
      } else {
        value = '';
      }
      td.textContent = value;
    });
  });

  tableWrapper.appendChild(table);
  return tableWrapper;
}

export function initFineTasks(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const perTaskTitleElement = document.createElement('h3');
  perTaskTitleElement.textContent = 'Task Results';
  perTaskTitleElement.className = 'fine-tasks-title';

  const perTaskTableContainer = document.createElement('div');
  perTaskTableContainer.className = 'table-container';

  let perTaskDataTable;

  function updatePerTaskResults() {
    const language = languageDropdownPerTask.value;
    const metric = metricDropdownPerTask.value;
    const tableType = tableTypeDropdownPerTask.value;
    const taskFolder = taskFolderDropdownPerTask.value;

    const languageCode = languageMap[language];

    if (!languageCode) {
      console.error(`Language code not found for ${language}`);
      perTaskTableContainer.innerHTML = `<p>Error: Language code not found for ${language}</p>`;
      return;
    }

    let url = `data/tasks/${taskFolder}/${languageCode}/${metric}/${tableType}_stats.csv`;

    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then(csvText => {
        const results = Papa.parse(csvText, { header: true }).data;
        perTaskTableContainer.innerHTML = '';
        const tableWrapper = createPerTaskResultsTable(results, tableType, metric);
        perTaskTableContainer.appendChild(tableWrapper);

        if (perTaskDataTable) {
          perTaskDataTable.destroy();
        }

        perTaskDataTable = new DataTable('.fine-tasks-results-table', {
          perPage: 10,
          perPageSelect: false,
          searchable: false,
          sortable: true,
          fixedHeight: true,
          labels: {
            info: ''  // This removes the "Showing 1 to X of Y entries" text
          }
        });

      })
      .catch(error => {
        console.error('Error fetching CSV:', error);
        perTaskTableContainer.innerHTML = `<p>Error loading data: ${error.message}</p>`;
      });
  }

  const perTaskControls = document.createElement('div');
  perTaskControls.className = 'controls fine-tasks-controls';

  // Task folder control group
  const taskFolderControlGroup = document.createElement('div');
  taskFolderControlGroup.className = 'control-group';
  const taskFolderLabelPerTask = document.createElement('label');
  taskFolderLabelPerTask.textContent = 'Task Set: ';
  const taskFolderDropdownPerTask = createDropdown(taskFolders, updatePerTaskResults);
  taskFolderDropdownPerTask.value = 'selected'; // Set default to FineTasks
  taskFolderControlGroup.appendChild(taskFolderLabelPerTask);
  taskFolderControlGroup.appendChild(taskFolderDropdownPerTask);

  // Language control group
  const languageControlGroup = document.createElement('div');
  languageControlGroup.className = 'control-group';
  const languageLabelPerTask = document.createElement('label');
  languageLabelPerTask.textContent = 'Language: ';
  const languageDropdownPerTask = createDropdown(Object.keys(languageMap), updatePerTaskResults);
  languageControlGroup.appendChild(languageLabelPerTask);
  languageControlGroup.appendChild(languageDropdownPerTask);

  // Table type control group
  const tableTypeControlGroup = document.createElement('div');
  tableTypeControlGroup.className = 'control-group';
  const tableTypeLabelPerTask = document.createElement('label');
  tableTypeLabelPerTask.textContent = 'Type: ';
  const tableTypeDropdownPerTask = createDropdown(tableTypes, updatePerTaskResults);
  tableTypeControlGroup.appendChild(tableTypeLabelPerTask);
  tableTypeControlGroup.appendChild(tableTypeDropdownPerTask);

  // Metric control group
  const metricControlGroup = document.createElement('div');
  metricControlGroup.className = 'control-group';
  const metricLabelPerTask = document.createElement('label');
  metricLabelPerTask.textContent = 'Criteria: ';
  const metricDropdownPerTask = createDropdown(metricTypes, updatePerTaskResults);
  metricDropdownPerTask.value = 'max_score'; // Set default to Max Score
  metricControlGroup.appendChild(metricLabelPerTask);
  metricControlGroup.appendChild(metricDropdownPerTask);

  perTaskControls.appendChild(taskFolderControlGroup);
  perTaskControls.appendChild(languageControlGroup);
  perTaskControls.appendChild(tableTypeControlGroup);
  perTaskControls.appendChild(metricControlGroup);

  container.appendChild(perTaskControls);
  // container.appendChild(perTaskTitleElement);
  container.appendChild(perTaskTableContainer);

  // Initialize with default values
  updatePerTaskResults();
}
