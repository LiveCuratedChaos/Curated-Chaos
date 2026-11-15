import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',fullyParallel:false,workers:1,forbidOnly:!!process.env.CI,retries:0,
 timeout:30000,expect:{timeout:7000},reporter:process.env.CI?'github':'list',
 use:{baseURL:'http://127.0.0.1:5316',trace:'off',screenshot:'only-on-failure',video:'off',serviceWorkers:'block'},
 projects:[{name:'desktop-chromium',use:{...devices['Desktop Chrome']}},{name:'mobile-chromium',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
 webServer:{command:'node tools/browser-fixture-server.mjs',url:'http://127.0.0.1:5316/dev-dashboard.html',reuseExistingServer:false,timeout:20000},
});
