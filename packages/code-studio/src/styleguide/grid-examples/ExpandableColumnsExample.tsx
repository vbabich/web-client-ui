import React, { useState } from 'react';
import { Grid, MockExpandableColumnGridModel } from '@deephaven/grid';

function TreeExample(): JSX.Element {
  const [model] = useState(() => new MockExpandableColumnGridModel());

  return <Grid model={model} />;
}

export default TreeExample;
