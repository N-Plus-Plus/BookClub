-- DEVELOPMENT DEMO ONLY. Ratings and events are illustrative, not club history.
-- Each insert is gated by the seed marker: startup never reintroduces undone answers.
INSERT OR IGNORE INTO members(id,display_name,sort_order) SELECT 'member-1','Member 1',1 WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO members(id,display_name,sort_order) SELECT 'member-2','Member 2',2 WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO members(id,display_name,sort_order) SELECT 'member-3','Member 3',3 WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO members(id,display_name,sort_order) SELECT 'member-4','Member 4',4 WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO movies(id,title,original_title,year,release_date,runtime,overview,import_source,import_key)
SELECT 'arrival','Arrival','Arrival',2016,'2016-11-11',116,'A linguist searches for meaning when visitors arrive on Earth.','demo','arrival' WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO movies(id,title,original_title,year,runtime,overview,import_source,import_key)
SELECT 'moon','Moon','Moon',2009,97,'An isolated lunar worker approaches the end of his assignment.','demo','moon' WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO movies(id,title,original_title,year,runtime,overview,import_source,import_key)
SELECT 'spirited','Spirited Away','千と千尋の神隠し',2001,125,'A young girl discovers a world of spirits.','demo','spirited' WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO movies(id,title,year,runtime,import_source,import_key)
SELECT 'alien','Alien',1979,117,'demo','alien' WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO movies(id,title,year,runtime,import_source,import_key)
SELECT 'bicycle','Bicycle Thieves',1948,89,'demo','bicycle' WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO movies(id,title,year,runtime,import_source,import_key)
SELECT 'paris','Paris, Texas',1984,145,'demo','paris' WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO movies(id,title,year,runtime,import_source,import_key)
SELECT 'stalker','Stalker',1979,162,'demo','stalker' WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO movie_genres(movie_id,genre) SELECT id,'Drama' FROM movies WHERE import_source='demo' AND NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO movie_external_ids(movie_id,provider,external_id) SELECT 'arrival','tmdb','329865' WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO movie_external_ids(movie_id,provider,external_id) SELECT 'arrival','imdb','tt2543164' WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO movie_assets(id,movie_id,provider,asset_type,reference,preferred,fetched_at)
SELECT 'arrival-poster','arrival','tmdb','poster','https://image.tmdb.org/t/p/w500/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg',1,'2026-09-01T00:00:00Z' WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO movie_assets(id,movie_id,provider,asset_type,reference,preferred,fetched_at)
SELECT 'arrival-backdrop','arrival','tmdb','backdrop','https://image.tmdb.org/t/p/w1280/yIZ1xendyqKvY3FGeeUYUd5X9Mm.jpg',1,'2026-09-01T00:00:00Z' WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO movie_assets(id,movie_id,provider,asset_type,reference,preferred,fetched_at)
SELECT 'spirited-poster','spirited','tmdb','poster','https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',1,'2026-09-01T00:00:00Z' WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO classics(movie_id,source,legacy_reference) SELECT id,'development-demo',id FROM movies WHERE id IN ('spirited','alien','bicycle','paris','stalker') AND NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,import_source,import_key)
SELECT id||'-demo-tmdb',id,'tmdb','rating',CASE id WHEN 'spirited' THEN 8.5 WHEN 'alien' THEN 8.2 WHEN 'bicycle' THEN 8.1 WHEN 'paris' THEN 8.0 ELSE 8.3 END,10,NULL,1000,'2026-09-01T00:00:00Z','demo',id||'-tmdb' FROM movies WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,normalized_value,vote_count,fetched_at,import_source,import_key)
SELECT id||'-demo-imdb',id,'imdb','rating',8.0,10,80,1500,'2026-09-01T00:00:00Z','demo',id||'-imdb' FROM movies WHERE id!='stalker' AND NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO source_scores(id,movie_id,provider,metric,raw_value,raw_scale,normalized_value,fetched_at,import_source,import_key)
SELECT id||'-demo-critic',id,'demo-critic','rating',90,100,90,'2026-09-01T00:00:00Z','demo',id||'-critic' FROM movies WHERE id IN ('spirited','bicycle') AND NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO seen_states(movie_id,member_id,seen)
SELECT 'alien',id,1 FROM members WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO seen_states(movie_id,member_id,seen)
SELECT 'spirited',id,CASE WHEN sort_order=1 THEN 1 ELSE 0 END FROM members WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO seen_states(movie_id,member_id,seen)
SELECT 'bicycle',id,0 FROM members WHERE sort_order<3 AND NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO seen_states(movie_id,member_id,seen)
SELECT 'paris',id,1 FROM members WHERE sort_order<3 AND NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO seen_states(movie_id,member_id,seen)
SELECT 'stalker',id,1 FROM members WHERE sort_order<4 AND NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO sessions(id,event_date,title,host_member_id,legacy_cycle_label,notes,import_source,import_key)
SELECT 'demo-1','2026-09-26','First contact','member-1','Demo cycle A','Illustrative development event','demo','session-1' WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO sessions(id,event_date,title,host_member_id,legacy_cycle_label,import_source,import_key)
SELECT 'demo-2','2026-09-19','Far from home','member-2','Demo cycle A','demo','session-2' WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO sessions(id,event_date,title,host_member_id,legacy_cycle_label,import_source,import_key)
SELECT 'demo-3','2026-09-12','A long Saturday','member-3','Demo cycle B','demo','session-3' WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO session_movies(session_id,movie_id,position) SELECT 'demo-1','arrival',1 WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO session_movies(session_id,movie_id,position) SELECT 'demo-2','moon',1 WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO session_movies(session_id,movie_id,position) SELECT 'demo-2','spirited',2 WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO session_movies(session_id,movie_id,position) SELECT 'demo-3','bicycle',1 WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO session_movies(session_id,movie_id,position) SELECT 'demo-3','paris',2 WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO session_movies(session_id,movie_id,position) SELECT 'demo-3','alien',3 WHERE NOT EXISTS(SELECT 1 FROM seed_runs WHERE name='demo-v1');
INSERT OR IGNORE INTO seed_runs(name) VALUES('demo-v1');
