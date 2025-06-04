Feature: Import and Export Spaces
  As a Chrome Spaces user
  I want to import and export my spaces configuration
  So that I can backup my data and share workspace setups

  Background:
    Given I have the Chrome Spaces extension installed
    And I navigate to the Options page

  @export @core
  Scenario: Exporting all spaces to JSON
    Given I have these spaces configured:
      | Space Name    | URLs                                      |
      | Development   | github.com, localhost:3000, vscode.dev    |
      | Research      | arxiv.org, scholar.google.com             |
      | Communication | gmail.com, slack.com, discord.com         |
    When I click the "Export Spaces" button
    Then a JSON file should be downloaded
    And the file should contain all space names
    And the file should contain all tab URLs
    And the file should include metadata like export date

  @import @core
  Scenario: Importing spaces from JSON file
    Given I have a valid spaces export file
    When I click "Import Spaces"
    And I select the export file
    Then I should see a preview of spaces to import
    When I confirm the import
    Then all spaces should be imported successfully
    And I should see a success message with import statistics

  @import-validation
  Scenario: Validating import file format
    Given I try to import an invalid file
    When the file has invalid JSON syntax
    Then I should see an error "Invalid JSON format"
    When the file is missing required fields
    Then I should see specific validation errors
    When the file is too large (over 10MB)
    Then I should see "File too large" error

  @merge-strategy
  Scenario: Handling duplicate spaces during import
    Given I have a space named "Work" with 5 tabs
    And I import a file with a space named "Work" with 3 tabs
    When I choose "Merge" strategy
    Then the existing "Work" space should have 8 tabs
    When I choose "Replace" strategy
    Then the existing "Work" space should have 3 tabs
    When I choose "Rename" strategy
    Then I should have both "Work" and "Work (Imported)"

  @selective-import
  Scenario: Selective space import
    Given I am importing a file with 10 spaces
    When the import preview appears
    Then I should see checkboxes for each space
    When I uncheck 3 spaces
    And click "Import Selected"
    Then only 7 spaces should be imported

  @export-format
  Scenario: Export format options
    When I click on export options
    Then I should see format choices:
      | Format    | Description                         |
      | JSON      | Standard format, human-readable     |
      | Encrypted | Password-protected export           |
      | Chrome    | Chrome bookmarks compatible format  |
    When I select "Encrypted" and set a password
    Then the exported file should be encrypted

  @templates
  Scenario: Exporting as shareable templates
    Given I have a well-organized workspace
    When I export as a template
    Then URLs should be generalized:
      | Original URL          | Template URL        |
      | github.com/myuser     | github.com/[user]   |
      | localhost:3000        | localhost:[port]    |
      | myproject.slack.com   | [workspace].slack.com |
    And personal data should be removed

  @auto-backup
  Scenario: Automatic backup exports
    Given auto-backup is enabled in settings
    When 7 days have passed since last backup
    Then an automatic export should be created
    And saved to the designated backup folder
    And old backups should be rotated (keep last 5)

  @import-history
  Scenario: Import history and rollback
    Given I have performed several imports
    When I view import history
    Then I should see a list of past imports with dates
    When I select a previous import
    Then I should see what was imported
    And have the option to rollback to pre-import state

  @drag-drop
  Scenario: Drag and drop import
    Given I have the import dialog open
    When I drag a valid export file onto the drop zone
    Then the file should be accepted
    And the import preview should appear immediately
    When I drag an invalid file type
    Then the drop zone should show an error state

  @cloud-sync
  Scenario: Cloud backup integration
    Given I have connected my Google Drive
    When I click "Backup to Cloud"
    Then spaces should be exported to Google Drive
    And I should see the backup location
    When I click "Restore from Cloud"
    Then I should see a list of available backups
    And be able to restore any of them

  @partial-export
  Scenario: Exporting specific spaces only
    Given I have 20 spaces total
    When I select 5 spaces using checkboxes
    And click "Export Selected"
    Then only the selected 5 spaces should be exported
    And the export should indicate it's a partial export