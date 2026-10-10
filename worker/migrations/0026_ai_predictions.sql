CREATE TABLE ai_predictions (
 member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
 movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
 PRIMARY KEY(member_id,movie_id)
);
CREATE INDEX predictions_by_movie ON ai_predictions(movie_id,member_id);
CREATE TABLE member_preferences (
 member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
 show_ai INTEGER NOT NULL DEFAULT 0 CHECK(show_ai IN (0,1))
);
CREATE TRIGGER prediction_history_guard BEFORE INSERT ON ai_predictions
 WHEN EXISTS(SELECT 1 FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE sm.movie_id=NEW.movie_id AND s.deleted_at IS NULL)
 BEGIN SELECT RAISE(ABORT,'PREDICTION_HISTORY'); END;
CREATE TRIGGER prediction_update_history_guard BEFORE UPDATE ON ai_predictions
 WHEN EXISTS(SELECT 1 FROM session_movies sm JOIN sessions s ON s.id=sm.session_id WHERE sm.movie_id=NEW.movie_id AND s.deleted_at IS NULL)
 BEGIN SELECT RAISE(ABORT,'PREDICTION_HISTORY'); END;
CREATE TRIGGER prediction_member_guard BEFORE INSERT ON ai_predictions
 WHEN NOT EXISTS(SELECT 1 FROM members WHERE id=NEW.member_id AND active=1 AND sort_order BETWEEN 1 AND 4)
 BEGIN SELECT RAISE(ABORT,'PREDICTION_MEMBER'); END;
CREATE TRIGGER prediction_member_update_guard BEFORE UPDATE ON ai_predictions
 WHEN NOT EXISTS(SELECT 1 FROM members WHERE id=NEW.member_id AND active=1 AND sort_order BETWEEN 1 AND 4)
 BEGIN SELECT RAISE(ABORT,'PREDICTION_MEMBER'); END;
CREATE TRIGGER prediction_history_insert AFTER INSERT ON session_movies
 WHEN EXISTS(SELECT 1 FROM sessions WHERE id=NEW.session_id AND deleted_at IS NULL)
 BEGIN DELETE FROM ai_predictions WHERE movie_id=NEW.movie_id; END;
CREATE TRIGGER prediction_history_update AFTER UPDATE ON session_movies
 WHEN EXISTS(SELECT 1 FROM sessions WHERE id=NEW.session_id AND deleted_at IS NULL)
 BEGIN DELETE FROM ai_predictions WHERE movie_id=NEW.movie_id; END;
CREATE TRIGGER prediction_history_restore AFTER UPDATE ON sessions
 WHEN NEW.deleted_at IS NULL
 BEGIN DELETE FROM ai_predictions WHERE movie_id IN (SELECT movie_id FROM session_movies WHERE session_id=NEW.id); END;
-- Also covers imports that insert a parent after its deferred child rows.
CREATE TRIGGER prediction_history_parent AFTER INSERT ON sessions
 WHEN NEW.deleted_at IS NULL
 BEGIN DELETE FROM ai_predictions WHERE movie_id IN (SELECT movie_id FROM session_movies WHERE session_id=NEW.id); END;
