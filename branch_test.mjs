// 自测：分支应是国家大剧院单条简单路径（诱导子图恰好 1 头 1 叶，其余中间节点）
// 分支 = 图中所有“极大简单路径（源→汇）”。
// 本文件同时承担两件事：
//   1) 作为算法规格（含复杂用例：环 / 平行同标签路径 / 多源合并 / 回边）
//   2) 作为 mermaid-step-player.html 中 findBranches 的镜像实现，便于先测试再搬运
//
// 用法：node branch_test.mjs  （退出码 0=全过，1=有失败）

import assert from 'node:assert';

function buildAst(edges){
  const nodes = new Map();
  edges.forEach(([s,t]) => { nodes.set(s,1); nodes.set(t,1); });
  const links = edges.map(([s,t,label]) => ({ source:s, target:t, label }));
  return { nodes, links };
}

// 修复版：加 on-path 环检测（回边直接终止递归并标记 cyclic），对分支名去重，
// 并额外返回 backEdges（回边集合），供播放器把“循环边”用专门样式标出（不沿其遍历，避免死循环）。
function findBranches(ast){
  const indeg = new Map(), out = new Map();
  for(const id of ast.nodes.keys()){ indeg.set(id, 0); out.set(id, []); }
  ast.links.forEach(l => { indeg.set(l.target, indeg.get(l.target) + 1); out.get(l.source).push(l); });
  const sources = [...ast.nodes.keys()].filter(id => indeg.get(id) === 0);
  const isSink = id => out.get(id).length === 0;
  const branches = [];
  const seen = new Set();
  const backEdges = new Set();
  let cyclic = false;
  const labelOf = path => {
    const parts = [];
    for(let i = 1; i < path.length; i++){
      const l = ast.links.find(ll => ll.source === path[i-1] && ll.target === path[i]);
      let t = (l && l.label != null && String(l.label).trim()) ? String(l.label).trim()
              : (l && l.value != null && String(l.value).trim()) ? String(l.value).trim() : '';
      if(!t) t = path[i];
      parts.push(t);
    }
    return parts.length ? parts.join(' / ') : path[path.length - 1];
  };
  function dfs(u, cur, onPath){
    if(onPath.has(u)){ cyclic = true; return; }   // 回边：标记有环，且不再下钻，避免无限递归
    onPath.add(u);
    cur.push(u);
    if(isSink(u)){
      const key = cur.join('>');
      if(!seen.has(key)){ seen.add(key); branches.push({ path: cur.slice(), label: labelOf(cur) }); }
    } else {
      for(const l of out.get(u)){
        if(onPath.has(l.target)){ cyclic = true; backEdges.add(l.source + '|' + l.target); continue; } // 回边：记录为循环边，不下钻
        dfs(l.target, cur, onPath);
      }
    }
    cur.pop();
    onPath.delete(u);
  }
  for(const s of sources) dfs(s, [], new Set());
  // 名称去重：相同 label 追加 " #2" "#3" ...，保证下拉框每项唯一可选
  const cnt = new Map();
  for(const b of branches){
    const base = b.label;
    if(cnt.has(base)){
      const k = cnt.get(base) + 1; cnt.set(base, k);
      b.label = `${base} #${k}`;
    } else {
      cnt.set(base, 1);
    }
  }
  return { branches, cyclic, backEdges };
}

// 在分支的诱导子图（全图边中两端都在 bset 内的边）里统计头/叶
function check(ast, branch){
  const bset = new Set(branch.path);
  const indeg = new Map(), outdeg = new Map();
  for(const n of bset){ indeg.set(n,0); outdeg.set(n,0); }
  for(const l of ast.links){
    if(bset.has(l.source) && bset.has(l.target)){
      outdeg.set(l.source, outdeg.get(l.source)+1);
      indeg.set(l.target, indeg.get(l.target)+1);
    }
  }
  let heads = 0, leaves = 0;
  for(const n of bset){
    if(indeg.get(n) === 0) heads++;
    if(outdeg.get(n) === 0) leaves++;
  }
  return { heads, leaves, bsetSize: bset.size };
}

// ---- 复杂用例 ----
const sample1Edges = [
  ['A','B'],['B','C'],['B','D'],['C','E'],['D','E'],['E','F'],
];
const complexEdges = [
  ['EMPTY','BIND'],
  ['BIND','B1','旧: clear()'],
  ['B1','SHOWBUG'],
  ['BIND','B2','新: setDate(QDate())+setChangedDate(false)'],
  ['B2','SHOWOK'],
  ['B2','CMP'],
  ['CMP','C1','旧: date()->toString'],
  ['C1','REDBUG'],
  ['CMP','C2','新: 2000/01/01 占位归一空'],
  ['C2','REDOK'],
  ['C2','FMT','历史非空'],
  ['FMT','FOK'],
];
const sample2Edges = [
  ['S','G'],['G','A1','路A'],['G','B1','路B'],['G','C1','路C'],
  ['A1','A2'],['B1','B2'],['C1','C2'],
  ['A2','M'],['B2','M'],['C2','M'],['M','E'],
];
// 含环：Check --否--> Init 回边（示例三的核心结构）
const cyclicEdges = [
  ['Start','Init'],
  ['Init','subgraphCore'],
  ['subgraphCore','Check'],
  ['Check','Done','是'],
  ['Check','Init','否'],
];
// 平行同标签路径：两条不同路径得到相同 label，必须去重
const dupLabelEdges = [
  ['S','A','步'],
  ['A','M','合'],
  ['S','B','步'],
  ['B','M','合'],
];
// 大图：多源 + 合并 + 回边 + 带标签，综合复杂度
const bigEdges = [
  ['Start','Init'],
  ['Init','A','左'],
  ['Init','B','右'],
  ['A','C'],
  ['B','C'],
  ['C','D','深'],
  ['D','Done'],
  ['D','Init','回退'],   // 回边，应触发环检测且不死循环
];

const CASES = [
  { name:'示例一(无标签,易重名)', edges:sample1Edges, expectCount:2, expectCyclic:false, expectUnique:true },
  { name:'复杂图',               edges:complexEdges, expectCount:5, expectCyclic:false, expectUnique:true },
  { name:'示例二(三路)',         edges:sample2Edges, expectCount:3, expectCyclic:false, expectUnique:true },
  { name:'含环图(回边)',         edges:cyclicEdges,  expectCount:1, expectCyclic:true,  expectUnique:true, expectBack:'Check|Init' },
  { name:'平行同标签路径(去重)', edges:dupLabelEdges, expectCount:2, expectCyclic:false, expectUnique:true },
  { name:'大图(多源+合并+回边)', edges:bigEdges,     expectCount:2, expectCyclic:true,  expectUnique:true, expectBack:'D|Init' },
];

let failed = 0;
for(const c of CASES){
  process.stdout.write(`\n=== ${c.name} === `);
  try {
    const ast = buildAst(c.edges);
    const fb = findBranches(ast);
    const { branches, cyclic } = fb;

    assert.strictEqual(branches.length, c.expectCount,
      `分支数应为 ${c.expectCount}，实际 ${branches.length}`);
    assert.strictEqual(cyclic, c.expectCyclic,
      `cyclic 应为 ${c.expectCyclic}，实际 ${cyclic}`);
    if(c.expectBack){
      assert.ok(fb.backEdges.has(c.expectBack),
        `应检测到回边 ${c.expectBack}，实际 [${[...fb.backEdges].join(', ')}]`);
    }

    const names = new Set();
    for(const b of branches){
      const r = check(ast, b);
      assert.strictEqual(r.heads, 1, `分支"${b.label}"头数应=1，实际 ${r.heads}`);
      assert.strictEqual(r.leaves, 1, `分支"${b.label}"叶数应=1，实际 ${r.leaves}`);
      if(c.expectUnique){
        assert.ok(!names.has(b.label), `出现重复分支名："${b.label}"`);
        names.add(b.label);
      }
    }
    console.log(`PASS (${branches.length} 分支, cyclic=${cyclic}, 回边=[${[...fb.backEdges].join(', ')}])`);
    branches.forEach((b,i) => console.log(`   #${i+1} "${b.label}"  <- ${b.path.join(' -> ')}`));
  } catch(e){
    failed++;
    console.log(`FAIL: ${e.message}`);
  }
}

console.log(`\n==== 总计：${failed === 0 ? '全部 PASS ✓' : failed + ' 个用例 FAIL ✗'} ====`);
process.exit(failed === 0 ? 0 : 1);
