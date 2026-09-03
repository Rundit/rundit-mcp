export function invokeExpr(op) {
  const ns = op.ns;
  const fn = op.operation;
  const pathNames = op.pathParamNames;
  const queryNames = op.queryParamNames ?? [];

  if (op.hasBody) {
    if (pathNames.length === 0 && queryNames.length === 0) {
      return `(client, args) => client.${ns}.${fn}(args)`;
    }

    const destructure = [...pathNames, ...queryNames].join(', ');
    const args = [
      ...pathNames,
      'body',
      ...(queryNames.length ? [`{ ${queryNames.join(', ')} }`] : []),
    ].join(', ');
    return `(client, { ${destructure}, ...body }) => client.${ns}.${fn}(${args})`;
  }
  if (pathNames.length === 0 && op.hasQuery) {
    return `(client, args) => client.${ns}.${fn}(args)`;
  }
  if (pathNames.length === 0) {
    return `(client) => client.${ns}.${fn}()`;
  }
  if (op.hasQuery) {
    const destructure = pathNames.join(', ');
    const callArgs = pathNames.join(', ');
    return `(client, { ${destructure}, ...query }) => client.${ns}.${fn}(${callArgs}, query)`;
  }
  const destructure = pathNames.join(', ');
  const callArgs = pathNames.join(', ');
  return `(client, { ${destructure} }) => client.${ns}.${fn}(${callArgs})`;
}
