import Plotly from 'plotly.js-basic-dist-min';
import Papa from 'papaparse';
import _ from 'lodash';
import { getColor } from './colors.mjs';

const languageMap = {
  'Arabic': 'ar',
  'Turkish': 'tr',
  'Swahili': 'sw',
  'Russian': 'ru',
  'Telugu': 'te',
  'Thai': 'th',
  'Chinese': 'zh',
  'French': 'fr',
  'Hindi': 'hi'
};

const runNameMap = {
  "orion": "Dataset-A",
  "helios": "Dataset-B",
  "lynx": "Dataset-C",
  "aquila": "Dataset-D",
  "commoncrawl": "CommonCrawl",
  "baseline": "Baseline"
};

const taskLists = {
  ar: ['acva_ara:_average', 'alfgahafa_mlqa_ara_cf', 'alghafa_arc_ara_cf:easy', 'alghafa_facts_ara_cf', 'alghafa_meta_dialects_ara_cf', 'alghafa_mmlu_ara_cf:_average', 'alghafa_openbookqa_ara_cf', 'alghafa_piqa_ara_cf', 'alghafa_race_ara_cf', 'alghafa_rating_sentiment_ara_cf', 'alghafa_rating_sentiment_no_neutral_ara_cf', 'alghafa_sciqa_ara_cf', 'alghafa_sentiment_ara_cf', 'arcd_ara', 'belebele_arb_Arab_cf', 'boolq_ara', 'exams_ara_cf:_average', 'mkqa_ara:_average', 'mlmm_arc_ara_cf:challenge', 'mlmm_hellaswag_ara_cf', 'mlmm_mmlu_ara_cf:_average', 'mlmm_truthfulqa_ara_cf:mc1', 'mlmm_truthfulqa_ara_cf:mc2', 'mlqa_ara', 'mmlu_ara_cf:_average', 'soqal_ara_cf', 'toxigen_ara_cf', 'tydiqa_ara', 'xcodah_ara_cf', 'xcopa_ara_cf', 'xcsqa_ara_cf', 'xnli2.0_ara_cf', 'xnli_ara_cf', 'xquad_ara', 'xstory_cloze_ara_cf'],
  fr: ['belebele_fra_Latn_cf', 'community_boolq_fra_cf', 'exams_fra_cf:_average', 'fquadv2_fra', 'frenchbench_arc_fra_cf:challenge', 'frenchbench_hellaswag_fra_cf', 'meta_mmlu_fra_cf:_average', 'mintaka_fra', 'mkqa_fra:_average', 'mlmm_arc_fra_cf:challenge', 'mlmm_hellaswag_fra_cf', 'mlmm_mmlu_fra_cf:_average', 'mlmm_truthfulqa_fra_cf:mc1', 'mlmm_truthfulqa_fra_cf:mc2', 'pawsx_fra_cf', 'xcodah_fra_cf', 'xcsqa_fra_cf', 'xnli2.0_fra_cf', 'xwinograd_fra_cf'],
  hi: ['belebele_hin_Deva_cf', 'community_arc_hin_cf:challenge', 'community_arc_hin_cf:easy', 'community_boolq_hin', 'community_hellaswag_hin_cf', 'indicnxnli_hin_cf', 'indicqa_hin', 'indicxcopa_hin_cf', 'meta_mmlu_hin_cf:_average', 'mintaka_hin', 'mlmm_arc_hin_cf:challenge', 'mlmm_hellaswag_hin_cf', 'mlmm_mmlu_hin_cf:_average', 'mlmm_truthfulqa_hin_cf:mc1', 'mlmm_truthfulqa_hin_cf:mc2', 'mlqa_hin', 'xcodah_hin_cf', 'xcsqa_hin_cf', 'xnli2.0_hin_cf', 'xnli_hin_cf', 'xquad_hin', 'xstory_cloze_hin_cf'],
  ru: ['belebele_rus_Cyrl_cf', 'chegeka_rus', 'mathlogic_qa_rus_cf', 'mera_openbookqa_rus_cf', 'mera_worldtree_rus_cf', 'mkqa_rus:_average', 'mlmm_arc_rus_cf:challenge', 'mlmm_hellaswag_rus_cf', 'mlmm_mmlu_rus_cf:_average', 'mlmm_truthfulqa_rus_cf:mc1', 'mlmm_truthfulqa_rus_cf:mc2', 'parus_rus_cf', 'rcb_rus_cf', 'rummlu_rus_cf:_average', 'sber_squad_rus', 'tydiqa_rus', 'xcodah_rus_cf', 'xcsqa_rus_cf', 'xnli2.0_rus_cf', 'xquad_rus', 'xstory_cloze_rus_cf', 'xwinograd_rus_cf'],
  sw: ['afric_mmlu_swa_cf:_average', 'afric_xnli_swa_cf', 'belebele_swh_Latn_cf', 'community_arc_swa_cf:challenge', 'community_arc_swa_cf:easy', 'community_mmlu_swa_cf', 'kenswquad_swa', 'm3exams_swa_cf', 'openai_mmlu_swa_cf:_average', 'tydiqa_swa', 'xcodah_swa_cf', 'xcopa_swa_cf', 'xcsqa_swa_cf', 'xnli2.0_swa_cf', 'xnli_swa_cf', 'xstory_cloze_swa_cf'],
  te: ['belebele_tel_Telu_cf', 'community_hellaswag_tel_cf', 'indicnxnli_tel_cf', 'indicqa_tel', 'indicxcopa_tel_cf', 'mlmm_arc_tel_cf:challenge', 'mlmm_hellaswag_tel_cf', 'mlmm_mmlu_tel_cf:_average', 'mlmm_truthfulqa_tel_cf:mc1', 'mlmm_truthfulqa_tel_cf:mc2', 'tydiqa_tel', 'xstory_cloze_tel_cf'],
  th: ['belebele_tha_Thai_cf', 'community_hellaswag_tha_cf', 'm3exams_tha_cf', 'meta_mmlu_tha_cf:_average', 'mkqa_tha:_average', 'thai_exams_tha_cf:_average', 'thai_exams_tha_cf:tgat', 'thaiqa_tha', 'wsci_tha_cf', 'xcopa_tha_cf', 'xnli2.0_tha_cf', 'xnli_tha_cf', 'xquad_tha'],
  tr: ['belebele_tur_Latn_cf', 'community_arc_tur_cf:easy', 'community_hellaswag_tur_cf', 'community_mmlu_tur_cf:_average', 'community_truthfulqa_tur_cf:mc1', 'community_truthfulqa_tur_cf:mc2', 'community_xwinograd_tur_cf', 'exams_tur_cf:_average', 'mkqa_tur:_average', 'tquadv2_tur', 'xcopa_tur_cf', 'xnli2.0_tur_cf', 'xnli_tur_cf', 'xquad_tur'],
  zh: ['agieval_zho_cf:_average', 'belebele_zho_Hans_cf', 'c3_zho_cf', 'ceval_zho_cf:_average', 'chinese_squad_zho', 'cmath_zho_cf', 'cmmlu_zho_cf:_average', 'cmnli_zho_cf', 'cmrc2018_zho', 'm3exams_zho_cf', 'mkqa_zho:_average', 'mlmm_arc_zho_cf:challenge', 'mlmm_hellaswag_zho_cf', 'mlmm_mmlu_zho_cf:_average', 'mlmm_truthfulqa_zho_cf:mc1', 'mlmm_truthfulqa_zho_cf:mc2', 'ocnli_zho_cf', 'pawsx_zho_cf', 'xcodah_zho_cf', 'xcopa_zho_cf', 'xcsqa_zho_cf', 'xnli2.0_zho_cf', 'xnli_zho_cf', 'xquad_zho', 'xstory_cloze_zho_cf', 'xwinograd_zho_cf']
};

const LINE_SETTINGS = {
  width: 2.5,
  type: "scatter",
  mode: "lines+markers",
};

const DEFAULT_LAYOUT = {
  font: {
    family: "apple-system, Arial, sans-serif",
  },
  title: {
    font: {
      size: 15,
    },
  },
  xaxis: {
    title: {
      text: "Training Tokens (billions)",
      font: {
        size: 14,
      },
    },
    tickfont: {
      size: 12,
    },
    showgrid: false,
    mirror: true,
    ticks: "outside",
    showline: true,
  },
  yaxis: {
    title: {
      font: {
        size: 14,
      },
      standoff: 10,
    },
    showgrid: false,
    mirror: true,
    ticks: "outside",
    showline: true,
    tickfont: {
      size: 12,
    },
  },
  height: 300, // You can adjust this value
  autosize: true,
  legend: {
    orientation: 'h',        // Set to 'h' for horizontal legend (required for columns)
    yanchor: 'bottom',
    y: 0,                    // Position at the bottom
    xanchor: 'right',
    x: 1,                    // Position at the right
    traceorder: 'normal',
    font: { size: 12 },
    tracegroupgap: 0,        // Space between legend items
    bgcolor: 'rgba(255, 255, 255, 0.8)' // White background with 70% transparency (1 - 0.3 = 70%)
  },
  margin: {
    t: 25,
    b: 60,
    l: 60,
    r: 40,
  },
};

export function initPlotApplets() {
  const plotContainers = document.querySelectorAll('.task-signal-plot');
  plotContainers.forEach(container => {
    initPlotApplet(container);
  });
}

function initPlotApplet(container) {
  const defaultLanguage = container.dataset.language || 'Arabic';
  const defaultTask = container.dataset.task || '';
  const defaultMetric = container.dataset.metric || '';
  const groupSeeds = container.dataset.groupSeeds === 'true';
  const showControls = container.dataset.showControls === 'true';
  const taskMetrics = (container.dataset.taskMetrics || 'monotonicity,snr,ordering,randomness').split(",");

  const controls = createControls(container, defaultLanguage, defaultTask, defaultMetric, taskMetrics);
  if (!showControls)
    controls.style.display = 'none';
  container.appendChild(controls);

  const plotContainer = document.createElement('div');
  plotContainer.className = 'plot-container';
  container.appendChild(plotContainer);

  const statsContainer = document.createElement('div');
  statsContainer.className = 'stats-container';
  container.appendChild(statsContainer);


  // Create an initial empty plot
  Plotly.newPlot(plotContainer, []);

  // Set up the resize function
  const resizePlot = () => {
    const width = container.offsetWidth;
    Plotly.relayout(plotContainer, { width: width });
  };

  // Add resize listener
  window.addEventListener('resize', resizePlot);

  // Initial resize
  resizePlot();

  // Load the initial data
  updateLanguageTasks(container, defaultTask, defaultMetric, groupSeeds, taskMetrics);
}

function createControls(container, defaultLanguage, defaultTask, defaultMetric, taskMetrics) {
  const controls = document.createElement('div');
  controls.className = 'controls';

  const languageSelect = createSelect('language', Object.keys(languageMap), () => updateLanguageTasks(container, '', '', true, taskMetrics));
  languageSelect.value = defaultLanguage;

  const taskSelect = createSelect('task', [], () => updateMetrics(container, '', true, taskMetrics));
  const metricSelect = createSelect('metric', [], () => updatePlot(container, taskMetrics));

  controls.appendChild(createControlGroup('Language:', languageSelect));
  controls.appendChild(createControlGroup('Task:', taskSelect));
  controls.appendChild(createControlGroup('Metric:', metricSelect));

  return controls;
}

function createSelect(id, options, onChangeHandler) {
  const select = document.createElement('select');
  select.id = id;
  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    optionElement.textContent = option;
    select.appendChild(optionElement);
  });
  select.addEventListener('change', onChangeHandler);
  return select;
}

function createControlGroup(labelText, inputElement) {
  const group = document.createElement('div');
  group.className = 'control-group';
  
  const label = document.createElement('label');
  label.textContent = labelText;
  label.className = 'control-label';
  
  group.appendChild(label);
  group.appendChild(inputElement);
  
  return group;
}

async function updateLanguageTasks(container, defaultTask = '', defaultMetric = '', groupSeeds, taskMetrics) {
  const languageSelect = container.querySelector('#language');
  const taskSelect = container.querySelector('#task');
  const language = languageSelect.value;
  const langCode = languageMap[language];

  taskSelect.innerHTML = '<option value="">Loading tasks...</option>';

  try {
    const tasks = await getTasksForLanguage(langCode);
    
    taskSelect.innerHTML = '';
    if (tasks.length > 0) {
      tasks.forEach(task => {
        const option = document.createElement('option');
        option.value = task;
        option.textContent = truncateText(task, 25); // Reduced from 30 to 25
        option.title = task; // Set full task name as title for tooltip
        taskSelect.appendChild(option);
      });
      
      if (defaultTask && tasks.includes(defaultTask)) {
        taskSelect.value = defaultTask;
      } else {
        taskSelect.selectedIndex = 0;
      }
      
      await updateMetrics(container, defaultMetric, groupSeeds, taskMetrics);
    } else {
      taskSelect.innerHTML = '<option value="">No tasks available</option>';
      clearPlot(container);
    }
  } catch (error) {
    console.error('Error fetching tasks:', error);
    taskSelect.innerHTML = '<option value="">Error loading tasks</option>';
    clearPlot(container);
  }
}

async function getTasksForLanguage(langCode) {
  return taskLists[langCode] || [];
}

async function updateMetrics(container, defaultMetric = '', groupSeeds, taskMetrics) {
  const language = container.querySelector('#language').value;
  const task = container.querySelector('#task').value;
  const langCode = languageMap[language];
  const metricSelect = container.querySelector('#metric');

  metricSelect.innerHTML = '<option value="">Loading metrics...</option>';

  try {
    const metrics = await getMetricsForTask(langCode, task);
    
    metricSelect.innerHTML = '';
    metrics.forEach(metric => {
      const option = document.createElement('option');
      option.value = metric;
      option.textContent = metric;
      metricSelect.appendChild(option);
    });

    if (defaultMetric && metrics.includes(defaultMetric)) {
      metricSelect.value = defaultMetric;
    } else if (metricSelect.options.length > 0) {
      metricSelect.selectedIndex = 0;
    }

    await updatePlot(container, taskMetrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    metricSelect.innerHTML = '<option value="">Error loading metrics</option>';
    clearPlot(container);
  }
}

async function getMetricsForTask(langCode, task) {
  return new Promise((resolve, reject) => {
    Papa.parse(`data/nanotron_tasks/${langCode}/${task}_stats.csv`, {
      download: true,
      header: true,
      complete: function(results) {
        const metrics = [...new Set(results.data.map(row => row.metric).filter(metric => metric))];
        resolve(metrics);
      },
      error: function(error) {
        console.error('Error fetching metrics:', error);
        reject(error);
      }
    });
  });
}

function updatePlot(container, taskMetrics) {
  const language = container.querySelector('#language').value;
  const task = container.querySelector('#task').value;
  const metric = container.querySelector('#metric').value;
  const title = container.dataset.title;
  const langCode = languageMap[language];

  if (!langCode || !task || !metric) {
    clearPlot(container);
    return;
  }

  const dataUrl = `data/nanotron_tasks/${langCode}/${task}_data.csv`;
  const statsUrl = `data/nanotron_tasks/${langCode}/${task}_stats.csv`;

  Promise.all([
    new Promise((resolve, reject) => {
      Papa.parse(dataUrl, {
        download: true,
        header: true,
        dynamicTyping: true,
        complete: resolve,
        error: reject
      });
    }),
    new Promise((resolve, reject) => {
      Papa.parse(statsUrl, {
        download: true,
        header: true,
        dynamicTyping: true,
        complete: resolve,
        error: reject
      });
    })
  ]).then(([dataResult, statsResult]) => {
    const taskData = dataResult.data;
    const statsData = statsResult.data;
    plotData(container, taskData, statsData, metric, title, taskMetrics);
  }).catch(error => {
    console.error('Error parsing CSV:', error);
    clearPlot(container);
  });
}

function plotData(container, data, stats, metric, title, taskMetrics) {
  const groupSeeds = container.dataset.groupSeeds === 'true';
  const sortedData = sortDataByTokens(data);
  const groupedData = groupDataByRunname(sortedData, groupSeeds, metric);
  const interpolatedData = interpolateData(groupedData, metric);
  const smoothedData = smoothData(interpolatedData, metric);
  const traces = createTraces(smoothedData, metric);

  const plotContainer = container.querySelector('.plot-container');

  const layout = _.merge({}, DEFAULT_LAYOUT, {
    title: { text: `${title}` },
    xaxis: { 
      title: { text: 'Training Tokens (billions)' },
      tickvals: [0, 5, 10, 15, 20, 25],
      ticktext: ['0', '5B', '10B', '15B', '20B', '25B'],
      tickangle: 45,
      range: [0, 30], // Set the range to start from 0 and end at 30B
    },
    yaxis: { 
      title: { text: 'Score' },
      range: [Math.min(...traces.flatMap(trace => trace.y)) * 0.95, Math.max(...traces.flatMap(trace => trace.y)) * 1.05], // Add 5% padding to the top and bottom
    },
    width: container.offsetWidth,
  });

  Plotly.newPlot(plotContainer, traces, layout, {responsive: true});

  // Display statistics
  displayStatistics(container, stats, metric, taskMetrics);
}

function displayStatistics(container, stats, metric, taskMetrics) {
  const statsContainer = container.querySelector('.stats-container');
  const metricStats = stats.find(stat => stat.metric === metric);
  if (metricStats) {
    statsContainer.innerHTML = `
      <div class="compact-stats${taskMetrics.length === 1 ? '-single' : ''}">
        ${taskMetrics.includes('monotonicity') ? '<span title="Average Spearman Correlation">Monotonicity: ' + metricStats.avg_spearman.toFixed(2) + '</span>' : ''}
        ${taskMetrics.includes('snr') ? '<span title="Average Signal-to-Noise Ratio">Signal-to-Noise: ' + metricStats.avg_snr.toFixed(2) + '</span>' : ''}
        ${taskMetrics.includes('ordering') ? '<span title="Average Kendall Tau-a">Ordering Consistency: ' + metricStats.avg_kendall_tau_a.toFixed(2) + '</span>' : ''}
        ${taskMetrics.includes('randomness') ? '<span title="Max N Standard Deviations">Non-Randomness: ' + metricStats.max_n_std.toFixed(2) + '</span>' : ''}
      </div>
    `;
  } else {
    statsContainer.innerHTML = '<p>No statistics available for this metric.</p>';
  }
}

function getReducedTickValues(tokens) {
  const uniqueTokens = [...new Set(tokens)].sort((a, b) => a - b);
  const tokenCount = uniqueTokens.length;
  const targetTickCount = 10; // Adjust this value to increase/decrease the number of ticks

  if (tokenCount <= targetTickCount) {
    return uniqueTokens;
  }

  const stride = Math.ceil(tokenCount / targetTickCount);
  return uniqueTokens.filter((_, index) => index % stride === 0);
}

function formatTickLabel(value) {
  if (value >= 1e9) {
    return (value / 1e9).toFixed(1) + 'B';
  } else if (value >= 1e6) {
    return (value / 1e6).toFixed(1) + 'M';
  } else if (value >= 1e3) {
    return (value / 1e3).toFixed(1) + 'K';
  }
  return value.toString();
}

function computeStatistics(data, metric) {
  const stats = {
    avg_spearman: 0,
    avg_kendall_tau_a: 0,
    avg_snr: 0,
    max_n_std: 0
  };

  const baselineRun = Object.keys(data).find(key => key.toLowerCase().includes('baseline'));
  const nonBaselineRuns = Object.keys(data).filter(key => key !== baselineRun);

  // Compute statistics for each non-baseline run
  nonBaselineRuns.forEach(run => {
    const runData = data[run];
    const tokens = runData.map(row => row.tokens);
    const scores = runData.map(row => row[metric]);

    // Spearman correlation
    stats.avg_spearman += spearmanCorrelation(tokens, scores);

    // Kendall Tau-a
    const lastHalf = Math.floor(runData.length / 2);
    const kendallTauValues = [];
    for (let i = lastHalf; i < runData.length - 1; i++) {
      kendallTauValues.push(kendallTauA(scores.slice(0, i + 1), scores.slice(0, i + 2)));
    }
    stats.avg_kendall_tau_a += _.mean(kendallTauValues);

    // SNR and max_n_std
    if (baselineRun) {
      const baselineScores = data[baselineRun].map(row => row[metric]);
      const stdDev = standardDeviation(scores);
      stats.avg_snr += _.mean(scores) / stdDev;
      stats.max_n_std = Math.max(stats.max_n_std, (_.max(scores) - _.mean(baselineScores)) / stdDev);
    }
  });

  // Average the statistics
  const numRuns = nonBaselineRuns.length;
  stats.avg_spearman /= numRuns;
  stats.avg_kendall_tau_a /= numRuns;
  stats.avg_snr /= numRuns;

  return stats;
}

function spearmanCorrelation(x, y) {
  const n = x.length;
  const rankX = rankData(x);
  const rankY = rankData(y);
  
  let sum_d_squared = 0;
  for (let i = 0; i < n; i++) {
    const d = rankX[i] - rankY[i];
    sum_d_squared += d * d;
  }
  
  return 1 - (6 * sum_d_squared) / (n * (n * n - 1));
}

function rankData(data) {
  const sorted = [...data].sort((a, b) => a - b);
  return data.map(x => sorted.indexOf(x) + 1);
}

function kendallTauA(x, y) {
  const n = x.length;
  let concordant = 0;
  let discordant = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sign_x = Math.sign(x[j] - x[i]);
      const sign_y = Math.sign(y[j] - y[i]);
      if (sign_x * sign_y > 0) concordant++;
      else if (sign_x * sign_y < 0) discordant++;
    }
  }

  return (concordant - discordant) / (n * (n - 1) / 2);
}

function standardDeviation(values) {
  const mean = _.mean(values);
  const squareDiffs = values.map(value => {
    const diff = value - mean;
    return diff * diff;
  });
  const avgSquareDiff = _.mean(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

function interpolateData(data, metric) {
  return _.mapValues(data, (rows) => {
    const sortedRows = _.sortBy(rows, 'tokens');
    const allTokens = _.uniq(_.flatMap(Object.values(data), rows => rows.map(r => r.tokens))).sort((a, b) => a - b);
    
    return allTokens.map(token => {
      const exactMatch = _.find(sortedRows, { tokens: token });
      if (exactMatch) return exactMatch;

      const lowerRow = _.findLast(sortedRows, r => r.tokens < token);
      const upperRow = _.find(sortedRows, r => r.tokens > token);

      if (!lowerRow) return { ...upperRow, tokens: token };
      if (!upperRow) return { ...lowerRow, tokens: token };

      const ratio = (token - lowerRow.tokens) / (upperRow.tokens - lowerRow.tokens);
      const interpolatedMetric = lowerRow[metric] + (upperRow[metric] - lowerRow[metric]) * ratio;

      return {
        ...lowerRow,
        tokens: token,
        [metric]: interpolatedMetric
      };
    });
  });
}

function smoothData(data, metric, windowSize = 3) {
  return _.mapValues(data, (rows) => {
    return rows.map((row, index, array) => {
      const window = array.slice(Math.max(0, index - windowSize + 1), index + 1);
      const smoothedMetric = _.meanBy(window, r => r[metric]);
      return { ...row, [metric]: smoothedMetric };
    });
  });
}

function sortDataByTokens(data) {
  return _.sortBy(data, 'tokens');
}

function groupDataByRunname(data, groupSeeds, metric) {
  // Remove null or undefined runs
  data = data.filter(row => row.runname != null && row.runname !== 'null_undefined');

  if (!groupSeeds) {
    return _.groupBy(data, row => `${processRunName(row.runname)}_${row.seed}`);
  }

  const grouped = _.groupBy(data, row => processRunName(row.runname));
  
  return _.mapValues(grouped, (rows) => {
    const stepGroups = _.groupBy(rows, 'tokens');
    return _.map(stepGroups, (stepRows) => {
      const meanMetric = _.meanBy(stepRows, row => parseFloat(row[metric]) || 0);
      return {
        ...stepRows[0],
        [metric]: meanMetric
      };
    });
  });
}

function processRunName(runname) {
  for (const [key, value] of Object.entries(runNameMap)) {
    if (runname.includes(key)) {
      return value;
    }
  }
  return runname;
}

function createTraces(groupedData, metric) {
  const colorsMapping = new Map();
  const sortedRunnames = Object.keys(groupedData).sort((a, b) => {
    if (a.includes('baseline')) return 1;
    if (b.includes('baseline')) return -1;
    return a.localeCompare(b);
  });

  return sortedRunnames.map((runname, index) => {
    const color = getColorForTrace(runname, colorsMapping, index);
    return {
      x: groupedData[runname].map(row => row.tokens),
      y: groupedData[runname].map(row => row[metric]),
      name: runname,
      line: { 
        color: color,
        shape: 'spline',
        ...LINE_SETTINGS
      },
      marker: {
        color: color,
        size: 6,
      },
      mode: 'lines+markers',
    };
  });
}

function getColorForTrace(traceName, colorsMapping, index) {
  const reusedColor = colorsMapping.get(traceName);
  if (reusedColor) {
    return reusedColor;
  }

  const color = getColor(index);
  colorsMapping.set(traceName, color);
  return color;
}

function clearPlot(container) {
  const plotContainer = container.querySelector('.plot-container');
  Plotly.purge(plotContainer);
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength - 2) + '..';
}

