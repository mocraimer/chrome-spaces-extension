Feature: Space Management
  As a Chrome user
  I want to manage my browser windows as named spaces
  So that I can organize and switch between different work contexts efficiently

  Background:
    Given I have the Chrome Spaces extension installed
    And the extension popup is open

  @core @smoke
  Scenario: Creating a new space from current window
    Given I have a browser window open with multiple tabs
    When I open the extension popup
    Then I should see my current window listed as a space
    And the space should show the number of tabs
    And the space should have a default name based on the window

  @core
  Scenario: Naming a space for the first time
    Given I have an unnamed space in my spaces list
    When I click the edit button for that space
    Then I should see an input field with the current space name
    When I type "Work Projects" and press Enter
    Then the space should be renamed to "Work Projects"
    And the new name should persist after closing the popup

  @core
  Scenario: Switching between spaces
    Given I have multiple spaces open:
      | Space Name     | Tab Count |
      | Work Projects  | 5         |
      | Personal       | 3         |
      | Research       | 8         |
    And I am currently in the "Personal" space
    When I click the "Switch" button for "Work Projects"
    Then Chrome should switch to the "Work Projects" window
    And the popup should close automatically

  @persistence
  Scenario: Space names persist across browser restarts
    Given I have renamed a space to "Important Research"
    When I close Chrome completely
    And I restart Chrome
    And I open the extension popup
    Then I should see the space named "Important Research"

  @core
  Scenario: Closing a space
    Given I have an active space named "Temporary Work"
    When I close the browser window for that space
    And I open the extension popup
    Then I should see "Temporary Work" in the closed spaces section
    And the space should retain its custom name

  @restore
  Scenario: Restoring a closed space
    Given I have a closed space named "Old Project" with these tabs:
      | URL                          |
      | https://github.com          |
      | https://stackoverflow.com   |
      | https://docs.google.com     |
    When I click the "Restore" button for "Old Project"
    Then a new browser window should open
    And it should contain all 3 original tabs
    And the space should be named "Old Project"

  @search
  Scenario: Searching for spaces
    Given I have many spaces:
      | Space Name           |
      | Work - Frontend      |
      | Work - Backend       |
      | Personal Blog        |
      | Shopping List        |
    When I type "Work" in the search field
    Then I should only see spaces containing "Work":
      | Space Name           |
      | Work - Frontend      |
      | Work - Backend       |

  @keyboard
  Scenario: Keyboard navigation in spaces list
    Given I have multiple spaces in my list
    When I press the Arrow Down key
    Then the next space should be highlighted
    When I press Enter
    Then Chrome should switch to the highlighted space

  @edge-case
  Scenario: Handling spaces with many tabs
    Given I have a space with 50 tabs
    When I view this space in the popup
    Then the space should display "50 tabs"
    And the popup should remain responsive
    And I should be able to switch to this space without issues

  @validation
  Scenario Outline: Space name validation
    Given I am editing a space name
    When I try to rename it to "<invalid_name>"
    Then the space name should be "<expected_result>"

    Examples:
      | invalid_name | expected_result    |
      |              | unchanged          |
      |     spaces   | "spaces"           |
      | a\nb         | "a b"              |
      | test    test | "test test"        |