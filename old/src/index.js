import { initLeaderboardResults } from './leaderboard_results.js';
import { initFineTasks } from './fine_tasks.js';
import { initPlotApplets } from './plot_task.js';
import 'simple-datatables/dist/style.css';

document.addEventListener('DOMContentLoaded', () => {
  initLeaderboardResults('leaderboard-results');
  initFineTasks('fine-tasks-results');
  initPlotApplets();
}, { once: true });
