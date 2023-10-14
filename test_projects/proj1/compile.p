message "start compile".
compile progWithInclude.p preprocess progWithInclude.p.preprocess.
compile progWithInclude.p debug-list progWithInclude.p.dbg.
compile progWithInclude.p xref progWithInclude.p.xref.
compile progWithInclude.p xref-xml progWithInclude.p.xref.xml.
compile progWithInclude.p listing progWithInclude.p.listing.
message "done".