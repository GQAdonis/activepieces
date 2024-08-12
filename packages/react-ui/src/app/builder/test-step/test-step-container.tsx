import { ActionType, TriggerType } from '@activepieces/shared';
import React from 'react';

import { TestActionSection } from './test-action-section';
import { TestTriggerSection } from './test-trigger-section';

type TestStepContainerProps = {
  flowVersionId: string;
  isSaving: boolean;
  flowId: string;
  type: ActionType | TriggerType;
};

const TestStepContainer = React.memo(
  ({ flowVersionId, isSaving, type, flowId }: TestStepContainerProps) => {
    return (
      <>
        <div className="text-md font-semibold mb-5">Generate Sample Data</div>
        {type === TriggerType.PIECE ? (
          <TestTriggerSection
            flowId={flowId}
            isSaving={isSaving}
            flowVersionId={flowVersionId}
          ></TestTriggerSection>
        ) : (
          <TestActionSection
            flowVersionId={flowVersionId}
            isSaving={isSaving}
          ></TestActionSection>
        )}
      </>
    );
  },
);
TestStepContainer.displayName = 'TestStepContainer';

export { TestStepContainer };
