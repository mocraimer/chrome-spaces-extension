Feature: Data Persistence and Synchronization
  As a Chrome Spaces user
  I want my spaces data to persist reliably
  So that I never lose my organized workspace setup

  Background:
    Given I have the Chrome Spaces extension installed

  @critical @persistence
  Scenario: Space data survives extension updates
    Given I have these named spaces:
      | Space Name      | Tab Count |
      | Development     | 12        |
      | Documentation   | 5         |
      | Communication   | 3         |
    When the Chrome Spaces extension is updated
    And I open the extension popup
    Then all my spaces should still be present
    And all space names should be preserved
    And all tab counts should be accurate

  @sync
  Scenario: Real-time synchronization between popup instances
    Given I have a space named "Active Project"
    And I have two popup windows open
    When I rename the space to "Completed Project" in the first popup
    Then the second popup should immediately show "Completed Project"

  @storage
  Scenario: Storage quota handling
    Given Chrome's local storage is nearly full
    When I try to create a new space with many tabs
    Then I should see a meaningful error message
    And existing spaces should remain intact
    And the extension should continue functioning

  @migration
  Scenario: Data migration from older versions
    Given I have space data from version 0.9.0 without version numbers
    When I install version 1.0.0
    Then all spaces should be migrated successfully
    And each space should have a version number
    And no data should be lost

  @backup
  Scenario: Automatic space backups
    Given I have important spaces configured
    When 24 hours have passed since the last backup
    Then the extension should create an automatic backup
    And old backups should be rotated out
    And I should be able to restore from any recent backup

  @conflict
  Scenario: Handling concurrent modifications
    Given I have a space named "Shared Work"
    When I edit the name in one popup to "Team Project"
    And simultaneously edit it in another popup to "Group Work"
    Then the last edit should win
    And no data corruption should occur
    And the state should be consistent across all views

  @recovery
  Scenario: Recovering from corrupted data
    Given my space data has become corrupted
    When I open the extension popup
    Then the extension should detect the corruption
    And attempt automatic recovery
    And show me a recovery status message
    And preserve as much data as possible

  @performance
  Scenario: Efficient loading with many spaces
    Given I have 100 spaces saved
    When I open the extension popup
    Then the popup should load within 2 seconds
    And display the first 10 spaces immediately
    And load remaining spaces progressively
    And remain responsive during loading

  @privacy
  Scenario: Local-only data storage
    Given I am using Chrome Spaces
    When I save spaces and rename them
    Then all data should be stored locally only
    And no data should be sent to external servers
    And Chrome sync should not include space data

  @cleanup
  Scenario: Automatic cleanup of old closed spaces
    Given I have closed spaces older than 30 days:
      | Space Name    | Closed Date  |
      | Old Project 1 | 45 days ago  |
      | Old Project 2 | 31 days ago  |
      | Recent Work   | 5 days ago   |
    When the cleanup process runs
    Then spaces older than 30 days should be removed
    And "Recent Work" should remain in closed spaces
    And I should be notified of the cleanup