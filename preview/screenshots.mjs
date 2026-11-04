// Percorre a prévia e salva capturas em ./shots (para revisão visual).
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const URL = process.env.URL || 'http://localhost:5173/';
fs.mkdirSync('shots', { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 760, height: 1000 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('console.error: ' + m.text().slice(0, 300)));

const phone = page.locator('.phone');
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => {
  await wait(450);
  await phone.screenshot({ path: `shots/${name}.png` });
  console.log('shot', name);
};
const byLabel = (label) => page.locator(`[aria-label="${label}"]`).first();
const tap = async (label) => { await byLabel(label).click(); await wait(350); };
const tab = async (name) => { await page.locator(`[aria-label^="${name}, tab"]`).first().click(); await wait(500); };
const fill = async (label, v) => { await page.locator(`input[aria-label="${label}"], textarea[aria-label="${label}"]`).first().fill(v); };
const scrollTo = (y) => page.evaluate((y) => {
  const els = [...document.querySelectorAll('.phone *')].filter((e) => e.scrollHeight > e.clientHeight + 8 && /auto|scroll/.test(getComputedStyle(e).overflowY));
  els.sort((a, b) => b.scrollHeight - a.scrollHeight);
  if (els[0]) els[0].scrollTop = y;
}, y);

await page.goto(URL);
await page.getByText('Entrar', { exact: true }).first().waitFor({ timeout: 15000 });
await shot('01-login');

await page.locator('[aria-label="Entrar"]').first().click(); await wait(300);
await shot('02-login-erros');

await tap('Criar conta'); await shot('03-cadastro');
await tap('Voltar'); await wait(300);
await tap('Esqueci minha senha'); await shot('04-esqueci-senha');
await tap('Voltar'); await wait(300);

await fill('E-mail', 'agente@sismorcego.demo');
await fill('Senha', 'senha123');
await tap('Entrar');
await page.getByText('Novo registro').first().waitFor({ timeout: 15000 });
await shot('05-registrar-topo');
for (const [i, y] of [[1, 650], [2, 1300], [3, 1950], [4, 2600]]) { await scrollTo(y); await shot(`06-registrar-scroll${i}`); }
await scrollTo(0);
await tap('Salvar registro'); await wait(600); await shot('07-registrar-erros');

await tap('Sexo'); await shot('08-select-aberto');
await tap('Feminino');

await tab('Buscar'); await shot('09-buscar');
await page.locator('[aria-label*="Curuçá"]').first().click(); await wait(600); await shot('10-buscar-opcoes-pdf');
await page.locator('[aria-label="Fechar"]').first().click(); await wait(500);
await fill('Buscar registros', 'belem'); await wait(300); await shot('11-buscar-filtrado');
await fill('Buscar registros', 'zzz'); await wait(300); await shot('12-buscar-vazio');
await fill('Buscar registros', '');

await tab('Conta'); await shot('13-conta');
await tab('Mais'); await shot('14-mais');
await page.locator('[aria-label^="Configurações"]').first().click(); await wait(500); await shot('15-configuracoes');
await tap('Voltar'); await wait(300);
await page.locator('[aria-label="Dúvidas"]').first().click(); await wait(800); await shot('16-duvidas');
await page.locator('[aria-label^="Como registro"]').first().click(); await wait(400); await shot('17-duvidas-aberta');
await tap('Voltar'); await wait(300);
await page.locator('[aria-label="Sobre o projeto"]').first().click(); await wait(600); await shot('18-sobre');
await tap('Voltar'); await wait(300);
await page.locator('[aria-label="Créditos"]').first().click(); await wait(500);
await page.locator('[aria-label^="Tecnologia"]').first().click(); await wait(400); await shot('19-creditos');
await tap('Voltar'); await wait(300);

// Escuro
await page.evaluate(() => window.__setScheme('dark')); await wait(500);
await shot('20-dark-mais');
await tab('Buscar'); await shot('21-dark-buscar');
await tab('Registrar'); await shot('22-dark-registrar');
await page.evaluate(() => window.__setScheme('light')); await wait(300);

// Alto contraste
await tab('Mais');
await page.locator('[aria-label^="Configurações"]').first().click(); await wait(500);
await page.locator('[aria-label="Alto contraste"]').first().click(); await wait(500); await shot('23-hc-configuracoes');
await tap('Voltar'); await wait(300);
await tab('Buscar'); await shot('24-hc-buscar');
await tab('Registrar'); await shot('25-hc-registrar');

console.log('\nERROS DE CONSOLE:', errors.length ? '\n' + [...new Set(errors)].join('\n') : 'nenhum');
await browser.close();
