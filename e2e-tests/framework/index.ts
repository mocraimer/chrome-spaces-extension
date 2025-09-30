/**
 * Chrome Spaces Extension - Interaction Flow Testing Framework
 *
 * A comprehensive framework for testing complex multi-step user interactions.
 *
 * @example
 * ```typescript
 * import { InteractionFlowBuilder, CommonUserFlows } from '../framework';
 *
 * test('user can search and rename space', async ({ page, context }) => {
 *   const flow = new InteractionFlowBuilder(page, context);
 *   await flow.initialize();
 *
 *   await flow
 *     .openPopup()
 *     .searchFor('example.com')
 *     .selectFirstResult()
 *     .pressF2()
 *     .editName('My Project')
 *     .saveEdit()
 *     .verifyNameChanged('My Project');
 * });
 * ```
 */

// Main components
export { InteractionFlowBuilder, FlowOptions } from './InteractionFlowBuilder';
export { UserActionSimulator, TypingOptions, ClickOptions, NavigationOptions } from './UserActionSimulator';
export { InteractionFlowAssertions, AssertionContext } from './InteractionFlowAssertions';
export { CommonUserFlows } from './CommonUserFlows';
export { FlowRecorder, RecordedAction, RecordedSession } from './FlowRecorder';

// Re-export for convenience
import { InteractionFlowBuilder } from './InteractionFlowBuilder';
import { CommonUserFlows } from './CommonUserFlows';

/**
 * Create a new interaction flow
 */
export function createFlow(page: any, context: any, options?: any): InteractionFlowBuilder {
  return new InteractionFlowBuilder(page, context, options);
}

/**
 * Create a flow with common user flows
 */
export function createCommonFlows(page: any, context: any, options?: any): {
  flow: InteractionFlowBuilder;
  common: CommonUserFlows;
} {
  const flow = new InteractionFlowBuilder(page, context, options);
  const common = new CommonUserFlows(flow);

  return { flow, common };
}

/**
 * Quick start helper - opens popup and returns initialized flow
 */
export async function quickStart(page: any, context: any, options?: any): Promise<InteractionFlowBuilder> {
  const flow = new InteractionFlowBuilder(page, context, options);
  await flow.initialize();
  await flow.openPopup();
  return flow;
}