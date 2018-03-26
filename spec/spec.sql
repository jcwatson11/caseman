
DECLARE @seqAccountNumber bigint;
EXEC [dbo].[X31_NextNumberBusinessDataSingleValueByType] @strType=N'ACCTNBR',@iNextNumber=@seqAccountNumber OUTPUT

DECLARE @pk0A01_AccountMaster bigint;
INSERT INTO [A01_AccountMaster] ([AccountNumber],[FamilyId],[AccountType],[FamilyMemberType],[FamilyConsolidate],[AllowTransactions],[Title],[FirstName],[MiddleName],[LastName],[Suffix],[OrganizationName],[Status]) VALUES (@seqAccountNumber, @0FamilyId, @0AccountType, @0FamilyMemberType, @0FamilyConsolidate, @0AllowTransactions, @0Title, @0FirstName, @0MiddleName, @0LastName, @0Suffix, @0OrganizationName, @0Status);

SELECT @pk0A01_AccountMaster = SCOPE_IDENTITY();

DECLARE @seqAddressId bigint;
EXEC [dbo].[X31_NextNumberBusinessDataSingleValueByType] @strType=N'ADDRESSID',@iNextNumber=@seqAddressId OUTPUT

DECLARE @pk1A03_AddressMaster bigint;
INSERT INTO [A03_AddressMaster] ([AddressId],[Type],[AddressLine1],[AddressLine2],[AddressLine3],[AddressLine4],[City],[State],[ZipPostal],[Country],[AddressIsPOBox],[Latitude],[Longitude],[DeliveryPoint]) VALUES (@seqAddressId, @1Type, @1AddressLine1, @1AddressLine2, @1AddressLine3, @1AddressLine4, @1City, @1State, @1ZipPostal, @1Country, @1AddressIsPOBox, @1Latitude, @1Longitude, @1DeliveryPoint);

SELECT @pk1A03_AddressMaster = SCOPE_IDENTITY();

DECLARE @pk2A02_AccountAddresses bigint;
INSERT INTO [A02_AccountAddresses] ([AccountNumber],[AddressId],[Active],[UseAsPrimary],[StartDate],[EndDate],[FunctionalCategory]) VALUES (@seqAccountNumber, @seqAddressId, @2Active, @2UseAsPrimary, @2StartDate, @2EndDate, @2FunctionalCategory);

SELECT @pk2A02_AccountAddresses = SCOPE_IDENTITY();

DECLARE @pk3A07_AccountEmails bigint;
INSERT INTO [A07_AccountEmails] ([AccountNumber],[EmailType],[EmailAddress],[Active],[UseAsPrimary],[DataSource],[FunctionalCategory],[OptOutIndicator],[OptOutReasonCode],[OptOutDate],[DateLastSynced],[ExternalSystem],[ExternalSystemId]) VALUES (@seqAccountNumber, @3EmailType, @3EmailAddress, @3Active, @3UseAsPrimary, @3DataSource, @3FunctionalCategory, @3OptOutIndicator, @3OptOutReasonCode, @3OptOutDate, @3DateLastSynced, @3ExternalSystem, @3ExternalSystemId);

SELECT @pk3A07_AccountEmails = SCOPE_IDENTITY();

DECLARE @pk4A01aAccountNotes bigint;
INSERT INTO [A01aAccountNotes] ([AccountNumber],[NoteType],[ShortComment],[LongComment],[DataSource]) VALUES (@seqAccountNumber, @4NoteType, @4ShortComment, @4LongComment, @4DataSource);

SELECT @pk4A01aAccountNotes = SCOPE_IDENTITY();

SELECT 0 AS id, 'pk0A01_AccountMaster' AS varname, @pk0A01_AccountMaster AS value

UNION ALL

SELECT 1 AS id, 'pk1A03_AddressMaster' AS varname, @pk1A03_AddressMaster AS value

UNION ALL

SELECT 2 AS id, 'pk2A02_AccountAddresses' AS varname, @pk2A02_AccountAddresses AS value

UNION ALL

SELECT 3 AS id, 'pk3A07_AccountEmails' AS varname, @pk3A07_AccountEmails AS value

UNION ALL

SELECT 4 AS id, 'pk4A01aAccountNotes' AS varname, @pk4A01aAccountNotes AS value
