let ActiveNode = null;
let ActiveWindow = null;
let UntrackActive = false;

let ERROR = null;

export function processWorkQueue(window, workQueue) {
  setActiveWindow(window);

  // time perf of loop
  let start = performance.now();

  let i = 0;

  while (!workQueue.isEmpty()) {
    let node = workQueue.poll();
    executeNode(window, node);

    i++;
  }

  let end = performance.now();

  // print perf of loop in milliseconds
  //console.log(`[processWorkQueue] ${i} nodes: ${(end - start).toFixed(2)}ms`);

  setActiveWindow(null);
}

function executeNode(window, node) {
  try {
    ActiveNode = node;

    if (node.updateState == NODE_DESTROYED) {
      ActiveNode = null;
      return;
    }

    cleanNode(node);
    let prevValue = node.value;
    node.value = node.fn(prevValue);

    if (node.value !== prevValue && node.type == MEMO) {
      let obs = node.observers;
      let length = obs.length;

      for (let i = 0; i < length; i++) {
        _queueNodeForUpdate(window, obs[i]);
      }
    }
  } catch (e) {
    console.error(e);
    handleError(e);
  } finally {
    ActiveNode = null;
  }
}

export function getActiveWindow() {
  return ActiveWindow;
}

export function getActiveNode() {
  return ActiveNode;
}

export function setActiveWindow(window) {
  ActiveWindow = window;
}

export function runInNode(node, fn) {
  let oldNode = ActiveNode;
  ActiveNode = node;
  fn();
  ActiveNode = oldNode;
}

// createId() returns a unique id for a node
// this is used to identify nodes in the dependency graph
// and to identify nodes in the work queue
let _id = 0;

function createId() {
  return _id++;
}

export function useState(initialValue) {

  let state = {
    id: createId(),
    value: initialValue,

    observers: [],
    observerSlots: []
  };

  function getState() {
    registerDependency(state);

    return state.value;
  }

  let _activeWindow = ActiveWindow;

  function setState(newValue) {
    if (newValue instanceof Function) {
      newValue = newValue(state.value);
    }

    writeState(_activeWindow, state, newValue);
  }

  return [getState, setState];
}

/*
function B(props) {
  let memoB = useMemo(() => {
    console.log('calc memoB @ B', props.count);
    return props.count * 1000;
  });

  return <div>{memoB()}</div>;
}

function CompA() {

  let [stateA, setStateA] = useState(100);

  useEffect(() => {
    console.log('useEffect @ CompA', stateA());
  });

  let memoA = useMemo(() => {
    console.log('calc memoA @ CompA', stateA());
    return stateA() * 100;
  });

  return <div>
   {stateA() < 300 ? <B count={stateA()} /> : null}
  </div>;
}

*/

function writeState(window, state, newValue) {

  let current = state.value;

  if (current !== newValue) {
    state.value = newValue;

    let observers = state.observers;
    let length = observers.length;

    for (let i = 0; i < length; i++) {
      _queueNodeForUpdate(window, observers[i]);
    }
  }
}

const NODE_FRESH = 0;
//const NODE_PENDING = 1;
const NODE_QUEUED = 2;
const NODE_DESTROYED = 3;

function _queueNodeForUpdate(window, node) {

  if (node.updateState === NODE_FRESH) {
    node.updateState = NODE_QUEUED;
    window.submitWork(node);
    return;
  }

  /*

  if (node.updateState === NODE_QUEUED) {
    console.log('node already queued');
    return;
  }

  if (node.updateState === NODE_DESTROYED) {
    console.log('node already destroyed');
    //throw new Error('node already destroyed');
    return;
  }
  */
}

function cleanNode(node) {
  _removeNodeFromSources(node);
  _removeNodeSubtree(node);

  node.updateState = NODE_FRESH;
}

function _removeNodeFromSources(node) {

  if (node.sources) {
    while (node.sources.length) {
      const source = node.sources.pop(),
        index = node.sourceSlots.pop(),
        obs = source.observers;

      // TODO: we don't need to check for observers list existence?
      if (obs && obs.length) {
        const n = obs.pop(),
          s = source.observerSlots.pop();
        if (index < obs.length) {
          n.sourceSlots[s] = index;
          obs[index] = n;
          source.observerSlots[index] = s;
        }
      }
    }
  }

  if (node.cleanups && node.cleanups.length) {
    // loop over the clean ups 
    for (let i = 0; i < node.cleanups.length; i++) {
      node.cleanups[i]();
    }

    node.cleanups = [];
  }
}

function _removeNodeSubtree(node) {

  if (node.children) {
    let childrenCount = node.children.length;

    for (let i = 0; i < childrenCount; i++) {
      let child = node.children[i];
      _removeNodeFromSources(child);

      child.updateState = NODE_DESTROYED;

      _removeNodeSubtree(child);
    }

    node.children = [];
  }
}


function registerDependency(state) {

  if (UntrackActive) {
    return;
  }

  let sSlot = state.observers ? state.observers.length : 0;

  ActiveNode.sources.push(state);
  ActiveNode.sourceSlots.push(sSlot);

  state.observers.push(ActiveNode);
  state.observerSlots.push(ActiveNode.sources.length - 1);

  /*

  state.observerSet.push(newObserver);

  console.log('state new observer', state.observers.map(o => o.id));
  // for performance, we want to keep track where the state is in the effect's sources array
  // just set it to effect.sources.length - 1 since we just pushed it
  state.observerSlots.push(newObserver.sources.length - 1);

  newObserver.sources.push(state);
  // for performance, we want to keep track where effect is in the state's observers array
  newObserver.sourceObserverSlots.push(state.observers.length - 1);

  console.log('newObserver.sourceObserverSlots', newObserver.sourceObserverSlots);
  */
}

function createEffect(fn, value) {

  const effect = {
    id: createId(),
    type: EFFECT,
    value: value,
    fn,
    depth: !ActiveNode ? 0 : ActiveNode.depth + 1,

    updateState: NODE_FRESH,
    updatedAt: null,

    parent: ActiveNode,
    children: [],

    sources: [],
    sourceSlots: [],

    cleanups: null,
    context: null
  };

  if (ActiveNode) {
    ActiveNode.children.push(effect);
  }

  return effect;
}

export function useDisposableEffect(fn, value, window) {
  let effect = createEffect(fn, value);

  (window || ActiveWindow).submitWork(effect);

  return () => untrack(() => cleanNode(effect));
}

export function untrack(fn) {

  UntrackActive = true;
  let val = fn();
  UntrackActive = false;

  return val;
}

/*

let [a, setA] = useState(0);

let memoA = useMemo(() => {

  return 1 + a();

});

let memoB = useMemo(() => {

  return memoA() + 1;

});

*/

export function useEffect(fn, value) {
  let effect = createEffect(fn, value);

  ActiveWindow.submitWork(effect);
}

const MEMO = 5;
const EFFECT = 6;

export function useMemo(fn) {

  let memo = {
    id: createId(),
    type: MEMO,
    value: null,
    fn,
    depth: !ActiveNode ? 0 : ActiveNode.depth + 1,
    //window: ActiveNode.window,

    parent: ActiveNode,

    updateState: NODE_FRESH,
    updatedAt: null,

    sources: [],
    sourceSlots: [],

    observers: [],
    observerSlots: []
  };

  if (ActiveNode) {
    ActiveNode.children.push(memo);
  }

  ActiveWindow.submitWork(memo);

  function readMemo() {
    registerDependency(memo);

    return memo.value;
  }

  return readMemo;
}

export function onCleanup(fn) {
  if (ActiveNode === null) {
    throw new Error();
  } else if (ActiveNode.cleanups === null) {
    ActiveNode.cleanups = [fn];
  } else {
    ActiveNode.cleanups.push(fn);
  }
}

export function useCallback(fn) {

  let _activeNode = ActiveNode;
  return () => {
    ActiveNode = _activeNode;
    return fn(...arguments);
  }
}

export function onError(fn) {
  ERROR || (ERROR = Symbol("error"));
  if (ActiveNode === null) {
    return;
  }

  else if (ActiveNode.context === null) ActiveNode.context = { [ERROR]: [fn] };
  else if (!ActiveNode.context[ERROR]) ActiveNode.context[ERROR] = [fn];
  else ActiveNode.context[ERROR].push(fn);
}

function castError(err) {
  if (err instanceof Error || typeof err === "string") return err;
  return new Error("Unknown error");
}

function handleError(err) {
  err = castError(err);

  const fns = ERROR && lookup(ActiveNode, ERROR);
  if (!fns) { throw err }
  for (const f of fns) f(err);
}

/*
console.log('node.sources', node.sources.map(s => s.id), node.sourceObserverSlots);

// each loop, take out the last source and its slot
const sourceToDelete = node.sources.pop(),
  deletedSourceIndex = node.sourceObserverSlots.pop(),
  // prep the observers list
  sourceToDeleteObservers = sourceToDelete.observers;

console.log('deleting', sourceToDelete.id)
console.log('sourceToDeleteObservers BEFORE', sourceToDeleteObservers.map(o => o.id));

// if there are observers, we need to remove the node from the observers list
// NOTE: but why do we need to check if there are observers? 
// unless there are bugs in the code, there should always be at least one observer (the node itself)
if (sourceToDeleteObservers && sourceToDeleteObservers.length) {

  // pop the last observer and its slot
  const poppedObserver = sourceToDeleteObservers.pop(),
    poppedObserverSlot = sourceToDelete.observerSlots.pop();

  // if the node we're removing is not the last one in the list,
  if (deletedSourceIndex < sourceToDeleteObservers.length) {

    // we need to swap the observer we just removed with the actual entry we want to remove

    sourceToDelete.observerSlots[deletedSourceIndex] = poppedObserverSlot;
    sourceToDeleteObservers[deletedSourceIndex] = poppedObserver;

    console.log('deletedSourceIndex', deletedSourceIndex);
    // need to update the slot of the observer we just swapped
    poppedObserver.sourceObserverSlots[poppedObserverSlot] = deletedSourceIndex;
  }
}
console.log('sourceToDeleteObservers AFTER', sourceToDeleteObservers.map(o => o.id));
*/

/*
function cleanNode(node) {

  //console.log('cleaning up node ', node.id)
  // remove the node from its sources
  if (node.sourceSet.size) {

    //console.log('sources', node.sourceSet.size);
    // for every node's source, we need to remove the node from the source's observers list 
    // (source can be either memo or signal)
    while (node.sourceSet.size) {

      let sourceList = Array.from(node.sourceSet);

      sourceList.forEach(source => {
        node.sourceSet.delete(source);
        source.observerSet.delete(node);
      });

    }
  }

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      cleanNode(node.children[i]);
    }
    node.children = [];
  }

  if (node.cleanups) {
    for (let i = 0; i < node.cleanups.length; i++) {
      node.cleanups[i]();
    }

    node.cleanups = [];
  }

  node.updateState = FRESH;
}

*/

function lookup(node, key) {
  return node
    ? node.context && node.context[key] !== undefined
      ? node.context[key]
      : lookup(node.parent, key)
    : undefined;
}

function createProvider(id, options) {

  return function Provider(props) {

    return () => {
      untrack(() => {
        ActiveNode.context = { [id]: props.value };
      });

      return props.children;
    };
  };
}

export function createContext(
  defaultValue,
  options
) {
  const id = Symbol("context");
  return { id, Provider: createProvider(id, options), defaultValue };
}

export function useContext(context) {
  let ctx;
  return (ctx = lookup(ActiveNode, context.id)) !== undefined ? ctx : context.defaultValue;
}

export function children(fn) {
  const children = useMemo(fn);
  const memo = useMemo(() => resolveChildren(children()));

  return memo;
}

function resolveChildren(children) {
  if (typeof children === "function" && !children.length) return resolveChildren(children());
  if (Array.isArray(children)) {
    const results = [];
    for (let i = 0; i < children.length; i++) {
      const result = resolveChildren(children[i]);
      Array.isArray(result) ? results.push.apply(results, result) : results.push(result);
    }
    return results;
  }
  return children;
}

console.log('STATEV2');