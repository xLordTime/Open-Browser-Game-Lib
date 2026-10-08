const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('dist/app.js', 'utf8');
const context = vm.createContext({ console });
// Run the actual pure rule functions from the browser source.
for (const [from, to] of [['function outcome(', 'function playTTT('], ['function connectWinner(', 'function playConnect('], ['const MILL_LINES=', 'function playMill(']]) {
  vm.runInContext(source.slice(source.indexOf(from), source.indexOf(to)), context);
}
function check(code) { return vm.runInContext(code, context); }
assert.equal(check("outcome(['X','X','X','','O','','','O',''])"), 'X');
assert.equal(check("outcome(['X','O','X','X','O','O','O','X','X'])"), 'draw');
assert.equal(check("outcome(['X','','','','O','','','',''])"), null);
assert.equal(check("tttScore(Array(9).fill(''), 'X')"), 0, 'Perfect play should draw');
// Exhaust every possible human response to the computer's actual strategy.
assert.equal(check(`(() => {
 function visit(board, player) {
  const result = outcome(board);
  if (result) return result !== 'X';
  if (player === 'X') {
   for (let i=0; i<9; i++) if (!board[i]) {
    const next=board.slice(); next[i]='X';
    if (!visit(next,'O')) return false;
   }
   return true;
  }
  let best=-Infinity, at=-1;
  board.forEach((value,i) => {
   if (!value) { board[i]='O'; const score=tttScore(board,'X'); board[i]='';
    if (score>best) { best=score; at=i; }
   }
  });
  board[at]='O'; return visit(board,'X');
 }
 return visit(Array(9).fill(''),'X');
})()`), true, 'Computer must never lose Tic-Tac-Toe');
assert.equal(check(`(() => { const b=Array(42).fill(0); [35,36,37,38].forEach(i=>b[i]=1); return connectWinner(b); })()`), 1);
assert.equal(check(`(() => { const b=Array(42).fill(0); [1,8,15,22].forEach(i=>b[i]=2); return connectWinner(b); })()`), 2);
assert.equal(check(`(() => { const b=Array(42).fill(0); [35,29,23,17].forEach(i=>b[i]=1); return connectWinner(b); })()`), 1);
assert.equal(check(`(() => { const b=Array(42).fill(0); [0,8,16,24].forEach(i=>b[i]=2); return connectWinner(b); })()`), 2);
assert.equal(check(`(() => { const b=Array(42).fill(0); [5,6,7,8].forEach(i=>b[i]=1); return connectWinner(b); })()`), 0, 'Row wrap is not a winning line');
assert.deepEqual(Array.from(check('millNeighbors(0)')).sort((a,b)=>a-b), [1,9]);
assert.deepEqual(Array.from(check('millNeighbors(4)')).sort((a,b)=>a-b), [1,3,5,7]);
for (let i=0; i<24; i++) assert.equal(check(`millNeighbors(${i}).every(n=>millNeighbors(n).includes(${i}))`), true);
vm.runInContext(fs.readFileSync('dist/catalog.js', 'utf8'), context);
assert.equal(check('GAMES.length'), 51);
assert.equal(check('new Set(GAMES.map(g=>g.id)).size'), 51);
assert.equal(check('GAMES.filter(g=>g.engine).length'), 14);
assert.equal(check("GAMES.every(g=>CATEGORIES.some(c=>c.id===g.category)&&g.mode.length&&(g.engine||g.url))"), true);
assert.equal(check("GAMES.filter(g=>g.url).every(g=>/^https:\\/\\//.test(g.url))"), true);
console.log('Passed: catalog integrity, all Tic-Tac-Toe human continuations, four Connect Four directions, row boundaries and Mühle adjacency.');

vm.runInContext(source.slice(source.indexOf('function chooseConnectMove(')), context);
assert.equal(check("(()=>{const b=Array(42).fill(0);b[35]=b[36]=b[37]=2;const before=b.join();const c=chooseConnectMove(b,3);return c===3&&b.join()===before})()"),true);
assert.equal(check("(()=>{const b=Array(42).fill(0);b[35]=b[36]=b[37]=1;return chooseConnectMove(b,3)})()"),3);
