import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const stylesPath = path.join(__dirname, '../src/styles.css')
let s = fs.readFileSync(stylesPath, 'utf8')
const start = s.indexOf('*{box-sizing')
const end = s.indexOf('/* —— Ajxdevx')
if (start < 0 || end < 0) {
  console.error('markers not found', start, end)
  process.exit(1)
}
let core = s.slice(start, end)
const map = [
  ['#5b6cf6', '#16a34a'], ['#7452db', '#15803d'], ['#6969f3', '#22c55e'], ['#5d5ef1', '#16a34a'], ['#6b66ed', '#15803d'],
  ['#6868f4', '#22c55e'], ['#7167eb', '#16a34a'], ['#4a4be0', '#15803d'], ['#3b3f78', '#14532d'], ['#5e667e', '#3f6212'],
  ['#f5f6ff', '#f0fdf4'], ['#eef0ff', '#ecfdf5'], ['#fbfcff', '#f7fee7'], ['#7778ec', '#16a34a'], ['#5b5cf0', '#16a34a'],
  ['#6464d8', '#15803d'], ['#f1f2ff', '#ecfdf5'], ['#e9e8ff', '#dcfce7'], ['#5d5ee9', '#16a34a'], ['#5c5de8', '#16a34a'],
  ['#5d5ee5', '#16a34a'], ['#6061d8', '#15803d'], ['#6061de', '#15803d'], ['#6263dd', '#15803d'], ['#6869df', '#15803d'],
  ['#6465d8', '#15803d'], ['#7d7af2', '#22c55e'], ['#8985f4', '#16a34a'], ['#8b87f5', '#4ade80'], ['#efefff', '#dcfce7'],
  ['#f7f7ff', '#f0fdf4'], ['#f2f2ff', '#ecfdf5'], ['#f2f3ff', '#ecfdf5'], ['#fafaff', '#f7fee7'], ['#fafbff', '#f7fee7'],
  ['#9ea0ff', '#86efac'], ['#a9a3fb', '#4ade80'], ['#665bf1', '#16a34a'], ['#8a71f5', '#22c55e'], ['#7c70f5', '#22c55e'],
  ['#5d5fe9', '#16a34a'], ['#5e5fee', '#16a34a'], ['#6a62ee', '#22c55e'], ['#6d5fed', '#16a34a'], ['#6a57e8', '#15803d'],
  ['#5f5fdb', '#15803d'], ['#5c5ee8', '#16a34a'], ['#4e52b9', '#14532d'], ['#e9ecff', '#dcfce7'], ['#d6dcff', '#bbf7d0'],
  ['rgba(91,92,240', 'rgba(22,163,74'], ['rgba(101,82,224', 'rgba(22,163,74'], ['rgba(131,119,242', 'rgba(74,222,128'],
  ['#0d9488', '#16a34a'], ['#0f766e', '#15803d'], ['#14b8a6', '#4ade80'], ['#2dd4bf', '#86efac'], ['#5eead4', '#86efac'],
  ['#134e4a', '#14532d'], ['#ea580c', '#65a30d'], ['#f6f8fc', '#f0fdf4'], ['#eef2f6', '#f0fdf4'],
]
for (const [a, b] of map) core = core.split(a).join(b)
core = core.replace(/font-size:(\d+)px/g, (_, n) => `font-size:${Math.min(28, Math.round(Number(n) * 1.45))}px`)
const head = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');

:root{
  font-family:"DM Sans",ui-sans-serif,system-ui,sans-serif;
  color:#14532d;
  background:#f0fdf4;
  font-synthesis:none;
  --primary:#16a34a;
  --primary-dark:#15803d;
  --primary-light:#4ade80;
  --accent:#65a30d;
  --border:#bbf7d0;
  --muted:#4d7c5c;
  --panel:#fff;
  --shadow:0 20px 50px rgba(20,83,45,.14);
  --sidebar-bg:#052e16;
  --sidebar-text:#ecfdf5;
  --sidebar-muted:#86efac;
}
html{font-size:18px}
`
const tail = `
/* Taskly — circular avatars & layout fixes */
.avatar{display:inline-flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;aspect-ratio:1/1!important;border-radius:50%!important;padding:0!important;line-height:1!important;overflow:hidden!important;box-sizing:border-box!important;text-align:center!important}
.avatar-md{width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;max-width:48px!important;max-height:48px!important;font-size:15px!important}
.avatar-sm{width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;max-width:38px!important;max-height:38px!important;font-size:12px!important}
.avatar-lg{width:60px!important;height:60px!important;min-width:60px!important;min-height:60px!important;max-width:60px!important;max-height:60px!important;font-size:18px!important}
.team-top .avatar{width:64px!important;height:64px!important;min-width:64px!important;min-height:64px!important;max-width:64px!important;max-height:64px!important}
.assignee-picker button{display:flex;align-items:center}
.assignee-picker .avatar{flex:0 0 auto}
.sidebar{width:300px!important;padding:26px 20px 20px!important;background:var(--sidebar-bg)!important;border-right:1px solid #14532d!important;color:var(--sidebar-text)!important}
.main-area{margin-left:300px!important;width:calc(100% - 300px)!important}
.brand{color:#ecfdf5!important;font-size:26px!important}
.brand-mark{background:linear-gradient(135deg,#22c55e,#16a34a)!important;box-shadow:0 10px 24px rgba(34,197,94,.45)!important}
.brand-dot{color:#86efac!important}
.workspace-switch{background:#14532d!important;border-color:#166534!important}
.workspace-icon{background:#166534!important;color:#bbf7d0!important}
.sidebar nav button,.project-shortcut{color:var(--sidebar-muted)!important;font-size:17px!important}
.sidebar nav button.active{color:#bbf7d0!important;background:rgba(34,197,94,.2)!important}
.upgrade-card{background:linear-gradient(145deg,#15803d,#65a30d)!important}
.primary{background:linear-gradient(135deg,#22c55e,#16a34a)!important;box-shadow:0 10px 22px rgba(22,163,74,.3)!important;font-size:17px!important;min-height:48px!important}
.page-head h1{font-size:36px!important}
.eyebrow{color:#16a34a!important;font-size:12px!important}
.custom-select-trigger{min-height:48px!important;font-size:17px!important;border-radius:14px!important;border-color:var(--border)!important}
.custom-select-menu button{font-size:16px!important}
.custom-select-menu button.active{background:#dcfce7!important;color:#14532d!important}
.kanban-body.is-drag-over{outline-color:#16a34a!important;background:rgba(34,197,94,.08)!important}
.login-page{background:#052e16!important}
.login-story{background:radial-gradient(circle at 35% 45%,rgba(34,197,94,.35),transparent 42%)!important}
.story-copy .eyebrow{color:#86efac!important}
.sidebar-credit{margin:14px 8px 0;font-size:14px;color:#86efac;text-align:center}
.sidebar-credit strong{color:#bbf7d0}
.progress::-webkit-progress-value{background:linear-gradient(90deg,#22c55e,#16a34a)!important}
body{min-width:1320px;background:#f0fdf4!important}
`
fs.writeFileSync(stylesPath, head + core + tail)
console.log('styles rebuilt', fs.statSync(stylesPath).size)
