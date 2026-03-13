import { readFileSync, writeFileSync } from 'fs';

// 1. Fix DashboardHome.tsx
const dashPath = 'client/src/pages/dashboard/DashboardHome.tsx';
let dash = readFileSync(dashPath, 'utf8');

const marker = "w-full min-h-screen h-auto bg-[#0B0F14]";
const returnIdx = dash.indexOf(marker);
if (returnIdx === -1) { console.error("marker not found"); process.exit(1); }

const returnStartSearch = dash.lastIndexOf("return (", returnIdx);
if (returnStartSearch === -1) { console.error("return not found"); process.exit(1); }

const lastSemicolon = dash.lastIndexOf(");");
if (lastSemicolon === -1) { console.error("); not found"); process.exit(1); }

const beforeReturn = dash.substring(0, returnStartSearch);
const afterReturn = dash.substring(lastSemicolon + 2);

console.log("Return block found at:", returnStartSearch, "to", lastSemicolon + 2);
