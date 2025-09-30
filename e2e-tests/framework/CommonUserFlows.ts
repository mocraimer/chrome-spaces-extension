/**
 * Common User Flows
 *
 * Prebuilt interaction flows for common Chrome Spaces operations.
 * These higher-level flows combine multiple actions into typical user scenarios.
 */

import { InteractionFlowBuilder } from './InteractionFlowBuilder';
import { TypingOptions } from './UserActionSimulator';

/**
 * Prebuilt common user flows for Chrome Spaces extension
 */
export class CommonUserFlows {
  constructor(private flow: InteractionFlowBuilder) {}

  /**
   * Complete flow: Create and name a new space
   */
  async createAndNameSpace(name: string, options?: TypingOptions): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.think('short');
    await this.flow.selectFirstResult();
    await this.flow.pressF2();
    await this.flow.editName(name, options);
    await this.flow.saveEdit();
    await this.flow.verifyNameChanged(name);

    return this.flow;
  }

  /**
   * Complete flow: Rename an existing space
   */
  async renameSpace(
    oldName: string,
    newName: string,
    options?: TypingOptions
  ): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.searchFor(oldName);
    await this.flow.verifySearchFiltered(1);
    await this.flow.selectFirstResult();
    await this.flow.pressF2();
    await this.flow.editName(newName, options);
    await this.flow.saveEdit();
    await this.flow.verifyNameChanged(newName, oldName);

    return this.flow;
  }

  /**
   * Complete flow: Search and switch to a space
   */
  async searchAndSwitch(query: string): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.searchFor(query);
    await this.flow.think('short');
    await this.flow.selectFirstResult();
    await this.flow.pressEnter();
    await this.flow.verifyWindowSwitched();

    return this.flow;
  }

  /**
   * Complete flow: Double-click rename
   */
  async doubleClickRename(
    spaceName: string,
    newName: string,
    options?: TypingOptions
  ): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.searchFor(spaceName);
    await this.flow.verifySearchFiltered(1);
    await this.flow.doubleClickToEdit(spaceName);
    await this.flow.editName(newName, options);
    await this.flow.saveEdit();
    await this.flow.verifyNameChanged(newName, spaceName);

    return this.flow;
  }

  /**
   * Complete flow: Search, rename, clear search, verify all visible
   */
  async searchRenameAndVerify(
    searchQuery: string,
    newName: string,
    options?: TypingOptions
  ): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.searchFor(searchQuery);
    await this.flow.verifySearchFiltered(1);
    await this.flow.selectFirstResult();
    await this.flow.pressF2();
    await this.flow.editName(newName, options);
    await this.flow.saveEdit();
    await this.flow.clearSearch();
    await this.flow.verifyAllSpacesVisible();
    await this.flow.verifySpaceVisible(newName);

    return this.flow;
  }

  /**
   * Complete flow: Rename multiple spaces in sequence
   */
  async bulkRename(
    mappings: Array<{ oldName: string; newName: string }>,
    options?: TypingOptions
  ): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();

    for (const { oldName, newName } of mappings) {
      await this.flow.searchFor(oldName);
      await this.flow.verifySearchFiltered(1);
      await this.flow.selectFirstResult();
      await this.flow.pressF2();
      await this.flow.editName(newName, options);
      await this.flow.saveEdit();
      await this.flow.verifyNameChanged(newName, oldName);
      await this.flow.clearSearch();
      await this.flow.think('short');
    }

    await this.flow.verifyAllSpacesVisible();
    return this.flow;
  }

  /**
   * Complete flow: Navigate with keyboard only (no mouse)
   */
  async keyboardOnlyNavigation(stepsDown: number = 3): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.think('short');
    await this.flow.navigateDown(stepsDown);
    await this.flow.verifySpaceSelected();
    await this.flow.think('short');
    await this.flow.navigateUp(1);
    await this.flow.verifySpaceSelected();

    return this.flow;
  }

  /**
   * Complete flow: Edit then cancel
   */
  async editAndCancel(spaceName: string): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.searchFor(spaceName);
    await this.flow.selectFirstResult();
    await this.flow.pressF2();
    await this.flow.verifyInEditMode();
    await this.flow.typeWithRealisticDelay('This should not save');
    await this.flow.cancelEdit();
    await this.flow.verifySpaceVisible(spaceName);

    return this.flow;
  }

  /**
   * Complete flow: Search with no results
   */
  async searchWithNoResults(query: string = 'xyz123nonexistent'): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.searchFor(query);
    await this.flow.verifySearchFiltered(0);
    await this.flow.clearSearch();
    await this.flow.verifyAllSpacesVisible();

    return this.flow;
  }

  /**
   * Complete flow: Rapid interaction (fast user)
   */
  async rapidInteraction(spaceName: string, newName: string): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.searchFor(spaceName, { minDelay: 10, maxDelay: 30 });
    await this.flow.selectFirstResult();
    await this.flow.pressF2();
    await this.flow.editName(newName, { minDelay: 10, maxDelay: 30 });
    await this.flow.saveEdit();
    await this.flow.verifyNameChanged(newName, spaceName);

    return this.flow;
  }

  /**
   * Complete flow: Slow, deliberate interaction (careful user)
   */
  async slowDeliberateInteraction(spaceName: string, newName: string): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.think('medium');
    await this.flow.searchFor(spaceName, { minDelay: 100, maxDelay: 300 });
    await this.flow.think('medium');
    await this.flow.selectFirstResult();
    await this.flow.think('short');
    await this.flow.pressF2();
    await this.flow.think('short');
    await this.flow.editName(newName, { minDelay: 100, maxDelay: 300 });
    await this.flow.think('short');
    await this.flow.saveEdit();
    await this.flow.verifyNameChanged(newName, spaceName);

    return this.flow;
  }

  /**
   * Complete flow: Multiple edit attempts with corrections
   */
  async multipleEditAttempts(spaceName: string): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.searchFor(spaceName);
    await this.flow.selectFirstResult();

    // First attempt - cancel
    await this.flow.pressF2();
    await this.flow.typeWithRealisticDelay('First Attempt');
    await this.flow.cancelEdit();

    // Second attempt - cancel
    await this.flow.pressF2();
    await this.flow.typeWithRealisticDelay('Second Attempt');
    await this.flow.cancelEdit();

    // Third attempt - save
    await this.flow.pressF2();
    await this.flow.typeWithRealisticDelay('Final Name');
    await this.flow.saveEdit();
    await this.flow.verifyNameChanged('Final Name', spaceName);

    return this.flow;
  }

  /**
   * Complete flow: Navigation then edit
   */
  async navigateAndEdit(stepsDown: number, newName: string): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.navigateDown(stepsDown);
    await this.flow.verifySpaceSelected();
    await this.flow.pressF2();
    await this.flow.editName(newName);
    await this.flow.saveEdit();
    await this.flow.verifyNameChanged(newName);

    return this.flow;
  }

  /**
   * Complete flow: Search, verify, then escape to clear
   */
  async searchAndEscape(query: string): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.searchFor(query);
    await this.flow.think('short');
    await this.flow.pressEscape();
    await this.flow.verifyAllSpacesVisible();

    return this.flow;
  }

  /**
   * Complete flow: Switch between multiple spaces
   */
  async switchBetweenSpaces(spaceNames: string[]): Promise<InteractionFlowBuilder> {
    for (const name of spaceNames) {
      await this.flow.openPopup();
      await this.flow.searchFor(name);
      await this.flow.selectFirstResult();
      await this.flow.pressEnter();
      await this.flow.verifyWindowSwitched();
      await this.flow.think('medium');
    }

    return this.flow;
  }

  /**
   * Complete flow: Hover and inspect (visual verification)
   */
  async hoverAndInspect(spaceName: string): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.searchFor(spaceName);
    await this.flow.hoverElement(`.space-item:has-text("${spaceName}")`);
    await this.flow.think('medium');
    await this.flow.verifySpaceVisible(spaceName);

    return this.flow;
  }

  /**
   * Complete flow: Error recovery - typo correction during rename
   */
  async typoCorrection(spaceName: string, newName: string): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.searchFor(spaceName);
    await this.flow.selectFirstResult();
    await this.flow.pressF2();

    // Type with simulated typos
    await this.flow.typeWithRealisticDelay(newName, {
      simulateTypos: true,
      minDelay: 50,
      maxDelay: 150
    });

    await this.flow.saveEdit();
    await this.flow.verifyNameChanged(newName, spaceName);

    return this.flow;
  }

  /**
   * Complete flow: Context switching - edit multiple spaces
   */
  async contextSwitching(
    edits: Array<{ spaceName: string; newName: string }>
  ): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();

    for (const { spaceName, newName } of edits) {
      await this.flow.clearSearch();
      await this.flow.searchFor(spaceName);
      await this.flow.selectFirstResult();
      await this.flow.pressF2();
      await this.flow.editName(newName);
      await this.flow.saveEdit();
      await this.flow.verifyNameChanged(newName, spaceName);
      await this.flow.think('short');
    }

    return this.flow;
  }

  /**
   * Complete flow: Verify search persistence across actions
   */
  async searchPersistence(query: string): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();
    await this.flow.searchFor(query);
    await this.flow.verifySearchFiltered(1);
    await this.flow.selectFirstResult();
    await this.flow.think('medium');
    await this.flow.navigateDown(1);
    await this.flow.navigateUp(1);
    await this.flow.verifySearchFiltered(1);

    return this.flow;
  }

  /**
   * Complete flow: Full CRUD-like operation sequence
   */
  async fullOperationSequence(
    spaceName: string,
    tempName: string,
    finalName: string
  ): Promise<InteractionFlowBuilder> {
    await this.flow.openPopup();

    // Find original
    await this.flow.searchFor(spaceName);
    await this.flow.verifySpaceVisible(spaceName);
    await this.flow.selectFirstResult();

    // First rename
    await this.flow.pressF2();
    await this.flow.editName(tempName);
    await this.flow.saveEdit();
    await this.flow.verifyNameChanged(tempName, spaceName);

    // Clear and verify
    await this.flow.clearSearch();
    await this.flow.verifyAllSpacesVisible();

    // Second rename
    await this.flow.searchFor(tempName);
    await this.flow.selectFirstResult();
    await this.flow.pressF2();
    await this.flow.editName(finalName);
    await this.flow.saveEdit();
    await this.flow.verifyNameChanged(finalName, tempName);

    // Final verification
    await this.flow.clearSearch();
    await this.flow.verifySpaceVisible(finalName);

    return this.flow;
  }

  /**
   * Get the underlying flow builder for custom operations
   */
  getFlow(): InteractionFlowBuilder {
    return this.flow;
  }
}