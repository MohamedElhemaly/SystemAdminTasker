import React from 'react';
import { TaskChecklist } from './TaskChecklist';

// Backwards-compatible forwarder for TaskChecklist
export const SubtasksList = (props) => {
  return <TaskChecklist {...props} />;
};

export default SubtasksList;
