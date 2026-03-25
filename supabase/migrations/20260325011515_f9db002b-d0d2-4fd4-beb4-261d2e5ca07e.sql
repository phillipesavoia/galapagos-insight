UPDATE asset_knowledge SET asset_class = 'Equities' WHERE ticker = '.VERDECIX F INDEX';

UPDATE asset_knowledge SET asset_class = 'Fixed Income' WHERE ticker IN (
  'EMGA LN EQUITY','IHYA LN EQUITY','JGRN LN EQUITY',
  'AFMEI2A LX EQUITY','FODCFAU LX EQUITY',
  'NRFHYIU ID EQUITY','SHFUSDI ID EQUITY','EMUSTRUU INDEX'
);