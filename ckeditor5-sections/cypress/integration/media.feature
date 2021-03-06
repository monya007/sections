Feature: Embedded media

  Media objects can be embedded and display a preview.

  Scenario: Add an empty image section
    Given I opened an empty document
    And I click the first section
    And I click the "Insert ..." toolbar button
    And I click the "Image" toolbar button
    Then there should be 1 image section

  Scenario: Toolbar on images
    Given there is an empty image section
    And I click the first section
    Then the section toolbar appears

  Scenario: Select an image
    Given there is an empty image section
    And I click the first section
    And I click the "Select media" button
    And I wait for the media loading indicator to disappear
    Then I should see an image preview
    And the preview contains a media entity

  Scenario: Add an image
    Given there is an empty image section
    And I click the first section
    And I click the "Add media" button
    And I wait for the media loading indicator to disappear
    Then I should see an image preview
    And the preview contains a media entity

  Scenario: Existing image section
    Given there is an image section
    Then I should see an image preview
    And the preview contains a media entity
