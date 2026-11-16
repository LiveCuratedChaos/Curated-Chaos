// Actor-bound manual workspace operations. No credentials, provider writes or QA conversion.
import {makeManualProject,makeManualTask,changeManualProject,changeManualTask,normalizeProjectWorkspace,MANUAL_WORKSPACE_ORIGIN} from '../src/project-workspace-model.mjs';
import {stableStringify} from './stable-json.mjs';
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const plain = v => v && Object.getPrototypeOf(v) === Object.prototype;
const projectFields = ['title','summary','status'];
const taskFields = ['title','description','day','status','priority','project_id','subtasks'];
function exact(value, names) {
  if (!plain(value) || Object.keys(value).sort().join(',') !== [...names].sort().join(',')) throw Error('Exact workspace command required.');
}
function owner(actor) { if (!uuid(actor?.ownerId)) throw Error('Verified workspace actor required.'); return actor.ownerId; }
function operation(value) { if (!uuid(value)) throw Error('Operation identity required.'); return value; }
function pick(value, names) { return Object.fromEntries(names.filter(name => Object.hasOwn(value, name)).map(name => [name, value[name]])); }
export function createProjectWorkspaceService({repository} = {}) {
  if (!repository || ['list','create','update','undo','history','replay'].some(k => typeof repository[k] !== 'function')) throw Error('Durable project workspace repository required.');
  async function rows(actor) {
    const result = await repository.list({ownerId: owner(actor)});
    const normalized = normalizeProjectWorkspace(result, actor.ownerId);
    if (normalized.projects.length + normalized.tasks.length !== result.length) throw Error('Unexpected workspace scope.');
    return result;
  }
  function receipt(result, ownerId, operationId) {
    const row = result?.record;
    if (!row || result.operationId !== operationId || typeof result.replayed !== 'boolean' || !uuid(row.id) ||
        row.owner_id !== ownerId || row.household_id !== null || row.visibility !== 'private' || row.origin !== MANUAL_WORKSPACE_ORIGIN ||
        !['project','task'].includes(row.item_type) || !Number.isSafeInteger(row.version) || row.version < 1 ||
        row.payload?.source !== 'manual' || row.payload.schemaVersion !== 1 || row.payload.fictional !== false ||
        row.deleted_at !== null && (typeof row.deleted_at !== 'string' || !Number.isFinite(Date.parse(row.deleted_at)))) throw Error('Workspace save could not be confirmed.');
    return result;
  }
  return Object.freeze({
    list: rows,
    async create(actor, input) {
      exact(input, ['operationId','record']); const ownerId = owner(actor), operationId = operation(input.operationId);
      const value = input.record; if (!plain(value) || !plain(value.payload)) throw Error('Manual record required.');
      const previous = await repository.replay({ownerId,operationId,kind:'create',intent:{ownerId,record:value}});
      if(previous)return receipt(previous,ownerId,operationId);
      const existing = await rows(actor), projects = normalizeProjectWorkspace(existing, ownerId).projects;
      const fields = value.item_type === 'project' ? projectFields : value.item_type === 'task' ? taskFields : null;
      if (!fields) throw Error('Manual project or task required.');
      const form = {...pick(value.payload, fields), section: value.section};
      const record = value.item_type === 'project' ? makeManualProject(form, ownerId) : makeManualTask(form, ownerId, projects);
      if (stableStringify(value) !== stableStringify(record)) throw Error('Protected manual fields changed.');
      return receipt(await repository.create({ownerId, operationId, record}), ownerId, operationId);
    },
    async update(actor, input) {
      exact(input, ['operationId','id','expectedVersion','payload']); const ownerId = owner(actor), operationId = operation(input.operationId);
      if (!uuid(input.id) || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1 || !plain(input.payload)) throw Error('Versioned workspace edit required.');
      const previous = await repository.replay({ownerId,operationId,kind:'update',intent:{ownerId,id:input.id,expectedVersion:input.expectedVersion,payload:input.payload}});
      if(previous)return receipt(previous,ownerId,operationId);
      const existing = await rows(actor), row = existing.find(r => r.id === input.id);
      if (!row) throw Error('This record changed. Refresh before editing.');
      const patch = pick(input.payload, row.item_type === 'project' ? projectFields : taskFields);
      const payload = row.item_type === 'project' ? changeManualProject(row, patch, ownerId) : changeManualTask(row, patch, ownerId, normalizeProjectWorkspace(existing, ownerId).projects);
      if (stableStringify(payload) !== stableStringify(input.payload)) throw Error('Protected manual fields changed.');
      return receipt(await repository.update({ownerId, operationId, id: row.id, expectedVersion: input.expectedVersion, payload}), ownerId, operationId);
    },
    async undo(actor, input) {
      exact(input, ['operationId','targetOperationId']); const ownerId = owner(actor), operationId = operation(input.operationId);
      return receipt(await repository.undo({ownerId, operationId, targetOperationId: operation(input.targetOperationId)}), ownerId, operationId);
    },
    async history(actor, input) {
      exact(input, ['id']); const ownerId = owner(actor); if (!uuid(input.id)) throw Error('Record identity required.');
      return repository.history({ownerId, id: input.id});
    }
  });
}
