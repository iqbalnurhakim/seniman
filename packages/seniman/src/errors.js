import { useState, onError } from 'seniman';
import fs from 'node:fs';
import { parse } from 'stacktrace-parser';

function addFileContentsToStackTraceLine(line) {

  try {
    if (line.file.startsWith('file://')) {
      let contents = fs.readFileSync(line.file.split('file://')[1], 'utf8');
      let lines = contents.split('\n');
      let lineContents = lines[line.lineNumber - 1];

      line.contents = lineContents;
    } else {
      line.contents = '';
    }
  } catch (err) {
    line.contents = '';
  }
}

const PRODUCTION_MODE = process.env.NODE_ENV == 'production';

export function ErrorViewer(props) {

  return <div style={{ padding: '20px' }}>
    {() => {
      if (PRODUCTION_MODE) {
        return <div>Error</div>;
      }

      return <div style={{ 'font-family': 'monospace' }}>
        <div>
          <div style={{ 'font-size': '24px' }}>{props.name}</div>
          <div style={{ 'font-size': '15px', 'margin-top': '5px' }}>{props.message}</div>
        </div>
        <div style={{ border: '1px solid #ccc', 'margin-top': '10px', 'padding': '10px' }}>
          {props.stack.map(line => {
            addFileContentsToStackTraceLine(line);
            return <div style={{ 'font-size': '13px', 'border-bottom': '1px solid #eee', 'margin-bottom': '10px' }}>
              <div>
                <span style={{ color: '#444' }}>{line.methodName}</span>
                <span style={{ color: '#666', 'overflow-wrap': 'break-word' }}>
                  <span> @ {line.file} at line {line.lineNumber}, column {line.column}</span>
                </span>
              </div>
              <div style={{ 'font-family': 'monospace', color: '#333', background: '#eee', padding: '10px', 'margin-bottom': '10px', 'margin-top': '10px' }}>
                <span>{line.contents}</span>
              </div>
            </div>;
          })}
        </div>
      </div>
    }}
  </div >
}

export function ErrorHandler(props) {
  let [runtimeError, set_runtimeError] = useState(null);

  onError((err) => {
    console.error(err);
    set_runtimeError(err);
  });

  return <div>
    {() => {
      let _runtimeError = runtimeError();

      if (_runtimeError) {
        let err = _runtimeError;
        let stack = parse(err.stack);
        return <ErrorViewer name={err.name} message={err.message} stack={stack} />;
      } else {
        return props.children;
      }
    }}
  </div>
}