import { useRef, useState } from "react";

import {
  type ChangeTaskCreationAutofillField,
  changeAutofillField,
  createInitialAutofillState,
  switchAutofillVariant,
  type TaskCreationAutofillContext,
  type TaskCreationAutofillMemory,
} from "./task-creation-autofill";
import { browserTaskCreationMemoryStore } from "./task-creation-autofill-storage";

export function useTaskCreationAutofill(context: TaskCreationAutofillContext) {
  const memoryRef = useRef<TaskCreationAutofillMemory>(undefined);
  const [state, setState] = useState(() => {
    const memory = browserTaskCreationMemoryStore().load(context.baseType);
    memoryRef.current = memory;
    return createInitialAutofillState({ ...context, memory });
  });

  const changeField: ChangeTaskCreationAutofillField = (field, value) => {
    setState((current) => changeAutofillField(current, field, value));
  };

  const changeVariant = (job: boolean) => {
    setState((current) =>
      switchAutofillVariant(current, job, context, memoryRef.current ?? { records: {} }),
    );
  };

  return { state, changeField, changeVariant };
}
