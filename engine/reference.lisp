;; Independent final-frame reference: directly call the CLWFK build pipeline.
(let ((*standard-input* (make-string-input-stream ""))) (load "engine/bridge.lisp"))
(let ((minchowidth 8.0) (gothicwidth 8.0) (hirawidth 0.4)
      (tateyokoratio 0.4) (tatekazari 1.5) (tomeheight 1.8) (kazariheight 1.4))
 (write-char #\@)
 (json-value (mapcar (lambda (sym) (skeleton2list (normkanji (rm-limit (applykanji sym 'mincho))) 'mincho)) '(永 語 あ)))
 (terpri))
(quit)
