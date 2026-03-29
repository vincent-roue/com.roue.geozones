/*
GeoZones v2.0.0 - Test & debug HomeyScript
------------------------------------------
- Liste les cartes Flow réellement exposées
- Vérifie les settings / config
- Teste les autocompletes
- Teste les actions / conditions non destructives autant que possible
- Journalise en détail les NOK et les SKIP
*/

const APP_ID = 'com.roue.geozones';
const APP_URI = `homey:app:${APP_ID}`;

const EXPECTED = {
  triggers: ['subject_entered_zone','subject_left_zone','subject_position_changed','subject_recalculated'],
  conditions: ['subject_is_in_zone','subject_is_of_type','zone_contains_subjects','zone_contains_subject_type','zone_contains_only_subject_types','subject_exists','zone_exists','tag_exists','subject_type_exists','coordinates_match_zone','coordinates_match_tag'],
  actions: ['evaluate_coordinates','update_and_evaluate_subject_position','evaluate_subject_position','distance_subject_subject','distance_subject_coordinates','distance_coordinates_coordinates','distance_subject_zone','distance_coordinates_zone','set_subject_type','rename_subject','reset_subject','purge_subjects','force_recalculate_subject'],
};

let OK = 0, NOK = 0, SKIP = 0;
const log = console.log;
function ok(label, details=''){ OK++; log(`✅ OK   ${label}${details ? ' :: ' + details : ''}`); }
function nok(label, err){ NOK++; log(`❌ NOK  ${label}`); if (err) { if (typeof err === 'string') log(`    ${err}`); else { log(`    message: ${err.message || err}`); if (err.description) log(`    description: ${err.description}`); if (err.stack) log(String(err.stack).split('\n').slice(0,8).join('\n')); } } }
function skip(label, details=''){ SKIP++; log(`⚪ SKIP ${label}${details ? ' :: ' + details : ''}`); }
function title(name){ log(`\n${'='.repeat(70)}\n${name}\n${'='.repeat(70)}`); }
function safe(v){ try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); } }
function norm(v){ return String(v || '').trim().toLowerCase(); }
function arr(v){ return Array.isArray(v) ? v : (v == null ? [] : [v]); }

async function getCards() {
  const [actionsRaw, conditionsRaw, triggersRaw] = await Promise.all([
    Homey.flow.getFlowCardActions(),
    Homey.flow.getFlowCardConditions(),
    Homey.flow.getFlowCardTriggers(),
  ]);
  const filter = raw => Object.values(raw || {}).filter(card => card && card.uri === APP_URI);
  return { actions: filter(actionsRaw), conditions: filter(conditionsRaw), triggers: filter(triggersRaw) };
}

function findConfigRoot(settings){
  const keys = Object.keys(settings || {});
  let best = null;
  for (const key of keys) {
    const value = settings[key];
    if (!value || typeof value !== 'object') continue;
    const score = (Array.isArray(value.zones) ? 2 : 0) + ((value.subjects && typeof value.subjects === 'object') ? 2 : 0) + (Array.isArray(value.sources) ? 1 : 0);
    if (score > 0 && (!best || score > best.score)) best = { key, score, value };
  }
  return best;
}

function zones(config){ return Array.isArray(config?.zones) ? config.zones : []; }
function subjects(config){ return config?.subjects && typeof config.subjects === 'object' ? Object.values(config.subjects) : []; }
function tags(config){ const s = new Set(); for (const z of zones(config)) for (const tag of arr(z.tags)) if (String(tag||'').trim()) s.add(String(tag).trim()); return [...s]; }
function subjectTypes(config){ const s = new Set(); for (const subj of subjects(config)) if (String(subj.subjectType||'').trim()) s.add(String(subj.subjectType).trim()); return [...s]; }
function zoneArg(z){ return { id: z.id || z.name, name: z.name || z.id }; }
function subjectArg(s){ return { id: s.id || s.subjectId || s.name, name: s.name || s.id || s.subjectId }; }
function firstCircle(config){ return zones(config).find(z => norm(z.type) === 'circle' && z.center); }
function firstPolygon(config){ return zones(config).find(z => norm(z.type) === 'polygon' && Array.isArray(z.paths) && z.paths.length); }
function insideCoords(zone){
  if (!zone) return null;
  if (norm(zone.type) === 'circle' && zone.center) return { lat: Number(zone.center.lat), long: Number(zone.center.lng) };
  if (norm(zone.type) === 'polygon' && Array.isArray(zone.paths) && zone.paths.length) return { lat: Number(zone.paths[0].lat), long: Number(zone.paths[0].lng) };
  return null;
}

async function runCondition(id, args={}) { return Homey.flow.runFlowCardCondition({ uri: APP_URI, id, args }); }
async function runAction(id, args={}) { return Homey.flow.runFlowCardAction({ uri: APP_URI, id, args }); }
async function autocomplete(type,id,name,query=''){ return Homey.flow.getFlowCardAutocomplete({ type, uri: APP_URI, id, name, query, args: {} }); }

async function main(){
  title('GeoZones v2.0.0 - Test & debug');
  try {
    const app = await Homey.apps.getApp({ id: APP_ID });
    ok('App installée', `${app.name} / version=${app.version}`);
  } catch (e) {
    nok('App installée', e); return;
  }

  const cards = await getCards();
  const actionIds = cards.actions.map(c => c.id);
  const conditionIds = cards.conditions.map(c => c.id);
  const triggerIds = cards.triggers.map(c => c.id);

  title('1. Cartes Flow exposées');
  for (const id of EXPECTED.triggers) triggerIds.includes(id) ? ok(`Trigger présent: ${id}`) : nok(`Trigger manquant: ${id}`);
  for (const id of EXPECTED.conditions) conditionIds.includes(id) ? ok(`Condition présente: ${id}`) : nok(`Condition manquante: ${id}`);
  for (const id of EXPECTED.actions) actionIds.includes(id) ? ok(`Action présente: ${id}`) : nok(`Action manquante: ${id}`);
  log('ACTION_IDS = ' + safe(actionIds));
  log('CONDITION_IDS = ' + safe(conditionIds));
  log('TRIGGER_IDS = ' + safe(triggerIds));

  title('2. Settings / config');
  let config = null;
  try {
    const settings = await Homey.apps.getAppSettings({ id: APP_ID });
    ok('getAppSettings', Object.keys(settings || {}).join(', ') || '(none)');
    const root = findConfigRoot(settings);
    if (!root) skip('Configuration principale', 'introuvable');
    else {
      config = root.value;
      ok('Configuration principale', `${root.key}`);
      ok('Résumé config', `zones=${zones(config).length}, subjects=${subjects(config).length}, tags=${tags(config).length}, subjectTypes=${subjectTypes(config).length}`);
      if (zones(config)[0]) log('FIRST_ZONE = ' + safe(zones(config)[0]));
      if (subjects(config)[0]) log('FIRST_SUBJECT = ' + safe(subjects(config)[0]));
    }
  } catch (e) { nok('getAppSettings', e); }

  title('3. Autocomplete');
  const autoTests = [
    ['flowcardcondition','subject_is_in_zone','subject'],
    ['flowcardcondition','subject_is_in_zone','zone'],
    ['flowcardcondition','subject_is_of_type','subject'],
    ['flowcardcondition','subject_is_of_type','subjectType'],
    ['flowcardcondition','tag_exists','tag'],
    ['flowcardcondition','zone_exists','zone'],
    ['flowcardaction','update_and_evaluate_subject_position','subject'],
    ['flowcardaction','distance_subject_zone','zone'],
    ['flowcardtrigger','subject_entered_zone','zone'],
  ];
  for (const [type,id,name] of autoTests) {
    const ids = type === 'flowcardaction' ? actionIds : type === 'flowcardcondition' ? conditionIds : triggerIds;
    if (!ids.includes(id)) { skip(`Autocomplete ${id}.${name}`, 'carte absente'); continue; }
    try {
      const result = await autocomplete(type,id,name,'');
      ok(`Autocomplete ${id}.${name}`, `count=${Array.isArray(result)?result.length:0}`);
      if (Array.isArray(result) && result.length) log('    sample=' + safe(result.slice(0,3)));
    } catch (e) { nok(`Autocomplete ${id}.${name}`, e); }
  }

  title('4. Conditions existe');
  if (!config) {
    skip('Conditions existe', 'config indisponible');
  } else {
    const z = zones(config)[0];
    const s = subjects(config)[0];
    const tag = tags(config)[0];
    const st = subjectTypes(config)[0];
    if (conditionIds.includes('zone_exists')) {
      try { const r = await runCondition('zone_exists', { zone: zoneArg(z) }); r === true ? ok('zone_exists vrai') : nok('zone_exists vrai', `got=${r}`); } catch(e){ nok('zone_exists vrai', e); }
      try { const r = await runCondition('zone_exists', { zone: { id:'__missing__', name:'__missing__' } }); r === false ? ok('zone_exists faux') : nok('zone_exists faux', `got=${r}`); } catch(e){ nok('zone_exists faux', e); }
    }
    if (s && conditionIds.includes('subject_exists')) { try { const r = await runCondition('subject_exists', { subject: subjectArg(s) }); r === true ? ok('subject_exists vrai') : nok('subject_exists vrai', `got=${r}`); } catch(e){ nok('subject_exists vrai', e); } }
    else skip('subject_exists vrai', 'aucun subject');
    if (tag && conditionIds.includes('tag_exists')) { try { const r = await runCondition('tag_exists', { tag: { id: tag, name: tag } }); r === true ? ok('tag_exists vrai') : nok('tag_exists vrai', `got=${r}`); } catch(e){ nok('tag_exists vrai', e); } }
    else skip('tag_exists vrai', 'aucun tag');
    if (st && conditionIds.includes('subject_type_exists')) { try { const r = await runCondition('subject_type_exists', { subjectType: { id: st, name: st } }); r === true ? ok('subject_type_exists vrai') : nok('subject_type_exists vrai', `got=${r}`); } catch(e){ nok('subject_type_exists vrai', e); } }
    else skip('subject_type_exists vrai', 'aucun subjectType');
  }

  title('5. Évaluation par coordonnées');
  if (!config) skip('evaluate_coordinates', 'config indisponible');
  else {
    const z = firstCircle(config) || firstPolygon(config) || zones(config)[0];
    const pt = insideCoords(z);
    if (!z || !pt) skip('evaluate_coordinates', 'aucune zone exploitable');
    else {
      if (actionIds.includes('evaluate_coordinates')) {
        try { const r = await runAction('evaluate_coordinates', pt); ok('evaluate_coordinates', safe(r)); } catch(e){ nok('evaluate_coordinates', e); }
      }
      if (conditionIds.includes('coordinates_match_zone')) {
        try { const r = await runCondition('coordinates_match_zone', { ...pt, zone: zoneArg(z) }); r === true ? ok('coordinates_match_zone') : nok('coordinates_match_zone', `got=${r}`); } catch(e){ nok('coordinates_match_zone', e); }
      }
      const tag = arr(z.tags)[0];
      if (tag && conditionIds.includes('coordinates_match_tag')) {
        try { const r = await runCondition('coordinates_match_tag', { ...pt, tag: { id: tag, name: tag } }); r === true ? ok('coordinates_match_tag') : nok('coordinates_match_tag', `got=${r}`); } catch(e){ nok('coordinates_match_tag', e); }
      } else skip('coordinates_match_tag', 'zone sans tag');
      if (actionIds.includes('distance_coordinates_coordinates')) {
        try { const r = await runAction('distance_coordinates_coordinates', { lat1: pt.lat, long1: pt.long, lat2: pt.lat + 0.001, long2: pt.long + 0.001 }); ok('distance_coordinates_coordinates', safe(r)); } catch(e){ nok('distance_coordinates_coordinates', e); }
      }
      if (actionIds.includes('distance_coordinates_zone')) {
        try { const r = await runAction('distance_coordinates_zone', { ...pt, zone: zoneArg(z) }); ok('distance_coordinates_zone', safe(r)); } catch(e){ nok('distance_coordinates_zone', e); }
      }
    }
  }

  title('6. Subjects / types / distances');
  if (!config) skip('Tests subject', 'config indisponible');
  else {
    const s = subjects(config)[0];
    const s2 = subjects(config)[1] || subjects(config)[0];
    const z = firstCircle(config) || firstPolygon(config) || zones(config)[0];
    const pt = insideCoords(z);
    if (!s) skip('Tests subject', 'aucun subject');
    else {
      const subj = subjectArg(s);
      if (actionIds.includes('update_and_evaluate_subject_position') && pt) {
        try { const r = await runAction('update_and_evaluate_subject_position', { subject: subj, ...pt }); ok('update_and_evaluate_subject_position', safe(r)); } catch(e){ nok('update_and_evaluate_subject_position', e); }
      }
      if (actionIds.includes('evaluate_subject_position')) {
        try { const r = await runAction('evaluate_subject_position', { subject: subj }); ok('evaluate_subject_position', safe(r)); } catch(e){ nok('evaluate_subject_position', e); }
      }
      if (actionIds.includes('force_recalculate_subject')) {
        try { const r = await runAction('force_recalculate_subject', { subject: subj }); ok('force_recalculate_subject', safe(r)); } catch(e){ nok('force_recalculate_subject', e); }
      }
      if (z && conditionIds.includes('subject_is_in_zone')) {
        try { const r = await runCondition('subject_is_in_zone', { subject: subj, zone: zoneArg(z) }); ok('subject_is_in_zone', `result=${r}`); } catch(e){ nok('subject_is_in_zone', e); }
      }
      const originalType = String(s.subjectType || '').trim();
      if (actionIds.includes('set_subject_type')) {
        try { await runAction('set_subject_type', { subject: subj, subjectType: '__GeoZones_Test_Type__' }); ok('set_subject_type', 'temporary type set'); } catch(e){ nok('set_subject_type', e); }
        if (conditionIds.includes('subject_is_of_type')) {
          try { const r = await runCondition('subject_is_of_type', { subject: subj, subjectType: { id: '__GeoZones_Test_Type__', name: '__GeoZones_Test_Type__' } }); r === true ? ok('subject_is_of_type') : nok('subject_is_of_type', `got=${r}`); } catch(e){ nok('subject_is_of_type', e); }
        }
        try { await runAction('set_subject_type', { subject: subj, subjectType: originalType }); ok('restore subject type'); } catch(e){ nok('restore subject type', e); }
      }
      const originalName = s.name || s.id;
      if (actionIds.includes('rename_subject')) {
        try { await runAction('rename_subject', { subject: subj, name: `${originalName} [TEST]` }); ok('rename_subject'); } catch(e){ nok('rename_subject', e); }
        try { await runAction('rename_subject', { subject: { id: s.id, name: `${originalName} [TEST]` }, name: originalName }); ok('restore subject name'); } catch(e){ nok('restore subject name', e); }
      }
      if (actionIds.includes('distance_subject_coordinates') && pt) {
        try { const r = await runAction('distance_subject_coordinates', { subject: subj, ...pt }); ok('distance_subject_coordinates', safe(r)); } catch(e){ nok('distance_subject_coordinates', e); }
      }
      if (actionIds.includes('distance_subject_zone') && z) {
        try { const r = await runAction('distance_subject_zone', { subject: subj, zone: zoneArg(z) }); ok('distance_subject_zone', safe(r)); } catch(e){ nok('distance_subject_zone', e); }
      }
      if (actionIds.includes('distance_subject_subject') && s2) {
        try { const r = await runAction('distance_subject_subject', { subjectA: subjectArg(s), subjectB: subjectArg(s2) }); ok('distance_subject_subject', safe(r)); } catch(e){ nok('distance_subject_subject', e); }
      }
      if (actionIds.includes('reset_subject')) {
        try { const r = await runAction('reset_subject', { subject: subj }); ok('reset_subject', safe(r)); } catch(e){ nok('reset_subject', e); }
      }
    }
  }

  title('7. Zone contains ...');
  if (!config) skip('Zone contains', 'config indisponible');
  else {
    const z = zones(config)[0];
    if (!z) skip('Zone contains', 'aucune zone');
    else {
      if (conditionIds.includes('zone_contains_subjects')) {
        try { const r = await runCondition('zone_contains_subjects', { zone: zoneArg(z) }); ok('zone_contains_subjects', `result=${r}`); } catch(e){ nok('zone_contains_subjects', e); }
      }
      const types = subjectTypes(config);
      if (types.length && conditionIds.includes('zone_contains_subject_type')) {
        try { const r = await runCondition('zone_contains_subject_type', { zone: zoneArg(z), subjectTypes: types.join(',') }); ok('zone_contains_subject_type', `result=${r}`); } catch(e){ nok('zone_contains_subject_type', e); }
      } else skip('zone_contains_subject_type', 'aucun subjectType');
      if (types.length && conditionIds.includes('zone_contains_only_subject_types')) {
        try { const r = await runCondition('zone_contains_only_subject_types', { zone: zoneArg(z), subjectTypes: types.join(',') }); ok('zone_contains_only_subject_types', `result=${r}`); } catch(e){ nok('zone_contains_only_subject_types', e); }
      } else skip('zone_contains_only_subject_types', 'aucun subjectType');
    }
  }

  title('8. Purge');
  if (actionIds.includes('purge_subjects')) {
    try { const r = await runAction('purge_subjects', { days: 99999 }); ok('purge_subjects', safe(r)); } catch(e){ nok('purge_subjects', e); }
  }

  title('Bilan final');
  log(`✅ OK   : ${OK}`);
  log(`❌ NOK  : ${NOK}`);
  log(`⚪ SKIP : ${SKIP}`);
}

await main();
