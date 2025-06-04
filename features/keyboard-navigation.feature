Feature: Keyboard Navigation and Accessibility
  As a power user or user with accessibility needs
  I want to control Chrome Spaces entirely with the keyboard
  So that I can work efficiently without using a mouse

  Background:
    Given I have the Chrome Spaces extension installed
    And the extension popup is open
    And I have multiple spaces available

  @keyboard @accessibility
  Scenario: Complete keyboard navigation flow
    When I press Tab
    Then the search input should be focused
    When I press Tab again
    Then the first space should be focused
    When I press Arrow Down
    Then the next space should be focused
    When I press Arrow Up
    Then the previous space should be focused
    When I press Enter
    Then Chrome should switch to the focused space

  @hotkeys
  Scenario: Global hotkey for opening popup
    Given the popup is closed
    When I press "Ctrl+Shift+S" (or "Cmd+Shift+S" on Mac)
    Then the extension popup should open
    And the search field should be focused

  @search @keyboard
  Scenario: Keyboard-driven search
    When I press "/" from anywhere in the popup
    Then the search field should be focused
    When I type "work"
    Then spaces should filter in real-time
    When I press Escape
    Then the search should clear
    And focus should return to the spaces list

  @edit @keyboard
  Scenario: Editing space names with keyboard
    Given I have a space selected with Arrow keys
    When I press F2
    Then the space name should become editable
    When I type a new name and press Enter
    Then the name should be saved
    When I press Escape while editing
    Then the edit should be cancelled

  @accessibility
  Scenario: Screen reader support
    When I navigate through spaces
    Then each space should announce its name
    And the number of tabs
    And whether it's the current space
    And available actions

  @keyboard-shortcuts
  Scenario: Quick actions with keyboard shortcuts
    Given I have a space selected
    When I press Delete
    Then I should see a confirmation dialog
    When I press "R"
    Then the space should be renamed (edit mode)
    When I press "S"
    Then Chrome should switch to that space

  @wrap-around
  Scenario: Navigation wrap-around
    Given I am focused on the last space
    When I press Arrow Down
    Then focus should wrap to the first space
    Given I am focused on the first space
    When I press Arrow Up
    Then focus should wrap to the last space

  @vim-navigation
  Scenario: Vim-style navigation (optional feature)
    Given Vim mode is enabled in settings
    When I press "j"
    Then focus should move down
    When I press "k"
    Then focus should move up
    When I press "gg"
    Then focus should jump to the first space
    When I press "G"
    Then focus should jump to the last space

  @multi-select
  Scenario: Multi-select with keyboard
    Given I am in multi-select mode
    When I press Space on a space item
    Then it should be selected/deselected
    When I press Ctrl+A
    Then all spaces should be selected
    When I press Delete with multiple spaces selected
    Then I should see a bulk action confirmation

  @focus-trap
  Scenario: Proper focus management
    Given a modal dialog is open
    When I press Tab repeatedly
    Then focus should cycle within the dialog
    And not escape to the background
    When I press Escape
    Then the dialog should close
    And focus should return to the triggering element

  @shortcuts-help
  Scenario: Discovering keyboard shortcuts
    When I press "?"
    Then a keyboard shortcuts help overlay should appear
    And it should show all available shortcuts
    When I press Escape
    Then the help should close

  @number-navigation
  Scenario: Quick switch with number keys
    When I press "1"
    Then Chrome should switch to the 1st space
    When I press "2"
    Then Chrome should switch to the 2nd space
    When I press "9"
    Then Chrome should switch to the 9th space
    When I press "0"
    Then Chrome should switch to the 10th space