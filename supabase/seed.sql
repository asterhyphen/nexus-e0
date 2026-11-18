-- Sample seed data for Nexus E-0
-- Sets up 6 tracks, 30 teams with sample codes, and sample admin statements

-- 1. Insert 6 Tracks (Capacity: 6 tracks * 5 teams = 30 teams if max_teams_per_track is 5, or 15 tracks if max is 2)
INSERT INTO tracks (id, name) VALUES
    (gen_random_uuid(), 'Artificial Intelligence & Agents'),
    (gen_random_uuid(), 'Decentralized Systems & Web3'),
    (gen_random_uuid(), 'Cybersecurity & Privacy Shield'),
    (gen_random_uuid(), 'Fintech & Algorithmic Markets'),
    (gen_random_uuid(), 'Healthcare & BioTech Solutions'),
    (gen_random_uuid(), 'Climate Tech & Clean Energy'),
    (gen_random_uuid(), 'Autonomous Robotics & IoT'),
    (gen_random_uuid(), 'Developer Tooling & Infrastructure')
ON CONFLICT (name) DO NOTHING;

-- 2. Insert Initial Admin problem statements
INSERT INTO problem_statements (id, team_id, body, source, created_at, updated_at) VALUES
    (gen_random_uuid(), NULL, 'Design a zero-knowledge identity verification gateway for decentralized autonomous organizations without storing biometric data.', 'admin', now(), now()),
    (gen_random_uuid(), NULL, 'Create an offline-first mesh disaster relief coordinator using Bluetooth Low Energy and localized vector embeddings.', 'admin', now(), now()),
    (gen_random_uuid(), NULL, 'Build an autonomous agent pipeline that detects subtle smart contract reentrancy bugs using formal symbolic execution.', 'admin', now(), now()),
    (gen_random_uuid(), NULL, 'Develop an ultra-low latency real-time telemetry anomaly detector for electric vehicle battery cell degradation.', 'admin', now(), now())
ON CONFLICT DO NOTHING;

-- 3. Seed 30 Teams with codes
INSERT INTO teams (name, code, code_hash) VALUES
    ('Quantum Leap', 'NEX-1001', encode(digest('NEX-1001', 'sha256'), 'hex')),
    ('CyberPulse', 'NEX-1002', encode(digest('NEX-1002', 'sha256'), 'hex')),
    ('AeroDynamics', 'NEX-1003', encode(digest('NEX-1003', 'sha256'), 'hex')),
    ('Synapse Labs', 'NEX-1004', encode(digest('NEX-1004', 'sha256'), 'hex')),
    ('HyperDrive', 'NEX-1005', encode(digest('NEX-1005', 'sha256'), 'hex')),
    ('ZeroDay Hunters', 'NEX-1006', encode(digest('NEX-1006', 'sha256'), 'hex')),
    ('Vortex Minds', 'NEX-1007', encode(digest('NEX-1007', 'sha256'), 'hex')),
    ('AlgoRhythm', 'NEX-1008', encode(digest('NEX-1008', 'sha256'), 'hex')),
    ('DeepForge', 'NEX-1009', encode(digest('NEX-1009', 'sha256'), 'hex')),
    ('ByteCrafters', 'NEX-1010', encode(digest('NEX-1010', 'sha256'), 'hex')),
    ('Solaris Squad', 'NEX-1011', encode(digest('NEX-1011', 'sha256'), 'hex')),
    ('Helix Innovators', 'NEX-1012', encode(digest('NEX-1012', 'sha256'), 'hex')),
    ('OmniShield', 'NEX-1013', encode(digest('NEX-1013', 'sha256'), 'hex')),
    ('EchoLogic', 'NEX-1014', encode(digest('NEX-1014', 'sha256'), 'hex')),
    ('VectorEdge', 'NEX-1015', encode(digest('NEX-1015', 'sha256'), 'hex')),
    ('Phantom Protocol', 'NEX-1016', encode(digest('NEX-1016', 'sha256'), 'hex')),
    ('Nebula Dynamics', 'NEX-1017', encode(digest('NEX-1017', 'sha256'), 'hex')),
    ('ChronoByte', 'NEX-1018', encode(digest('NEX-1018', 'sha256'), 'hex')),
    ('Apex Intellect', 'NEX-1019', encode(digest('NEX-1019', 'sha256'), 'hex')),
    ('Horizon Matrix', 'NEX-1020', encode(digest('NEX-1020', 'sha256'), 'hex')),
    ('Titan Cipher', 'NEX-1021', encode(digest('NEX-1021', 'sha256'), 'hex')),
    ('Binary Beacon', 'NEX-1022', encode(digest('NEX-1022', 'sha256'), 'hex')),
    ('Krypton Guild', 'NEX-1023', encode(digest('NEX-1023', 'sha256'), 'hex')),
    ('Astra Systems', 'NEX-1024', encode(digest('NEX-1024', 'sha256'), 'hex')),
    ('Spectra Ops', 'NEX-1025', encode(digest('NEX-1025', 'sha256'), 'hex')),
    ('Zenith Code', 'NEX-1026', encode(digest('NEX-1026', 'sha256'), 'hex')),
    ('Neural Nest', 'NEX-1027', encode(digest('NEX-1027', 'sha256'), 'hex')),
    ('Flux Core', 'NEX-1028', encode(digest('NEX-1028', 'sha256'), 'hex')),
    ('Apex Aurora', 'NEX-1029', encode(digest('NEX-1029', 'sha256'), 'hex')),
    ('Nexus Prime', 'NEX-1030', encode(digest('NEX-1030', 'sha256'), 'hex'))
ON CONFLICT (code) DO NOTHING;
