<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dbHost = 'localhost';
$dbName = 'crm';
$dbUser = 'dosxodjaev';
$dbPass = '19951717a';
$fallbackFile = __DIR__ . '/state_data.json';

$defaultState = [
    'selectedYear' => 2026,
    'selectedMonth' => (int)date('n') - 1,
    'cashierPass' => '1234',
    'staff' => [
        ['key' => 'timur', 'name' => 'Тимур (директор)', 'pass' => '1234', 'defaultRate' => 10],
        ['key' => 'zhalgas', 'name' => 'Жалгас (дизайнер)', 'pass' => '1234', 'defaultRate' => 10],
        ['key' => 'abzal', 'name' => 'Абзал (мастер сборки)', 'pass' => '1234', 'defaultRate' => 10],
        ['key' => 'albert', 'name' => 'Альберт (печатник)', 'pass' => '1234', 'defaultRate' => 10],
        ['key' => 'islam', 'name' => 'Ислам', 'pass' => '1234', 'defaultRate' => 10],
        ['key' => 'bexultan', 'name' => 'Бексултан', 'pass' => '1234', 'defaultRate' => 10],
        ['key' => 'aziz', 'name' => 'Азиз', 'pass' => '1234', 'defaultRate' => 10],
        ['key' => 'mahmud', 'name' => 'Махмуд', 'pass' => '1234', 'defaultRate' => 10],
        ['key' => 'adilbek', 'name' => 'Адильбек', 'pass' => '1234', 'defaultRate' => 10],
    ],
    'orders' => [],
    'expenses' => [],
    'debts' => [],
    'clients' => [],
    'inventory' => [],
    'checkins' => [],
    'payrollOverrides' => new stdClass()
];

$pdo = null;
try {
    $pdo = new PDO("mysql:host=$dbHost;dbname=$dbName;charset=utf8mb4", $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
    $pdo->exec("CREATE TABLE IF NOT EXISTS mp_app_state (
        id INT PRIMARY KEY,
        state_json LONGTEXT NOT NULL,
        updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
} catch (Exception $e) {
    $pdo = null;
}

function loadCurrentState($pdo, $fallbackFile, $defaultState) {
    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT state_json, updated_at FROM mp_app_state WHERE id = 1 LIMIT 1");
            $row = $stmt->fetch();
            if ($row && !empty($row['state_json'])) {
                $decoded = json_decode($row['state_json'], true);
                if (is_array($decoded)) {
                    return [
                        'state' => $decoded,
                        'updatedAt' => gmdate('Y-m-d\TH:i:s.000\Z', strtotime($row['updated_at']))
                    ];
                }
            }
        } catch (Exception $e) {}
    }
    if (file_exists($fallbackFile)) {
        $raw = @file_get_contents($fallbackFile);
        $decoded = @json_decode($raw, true);
        if (is_array($decoded) && isset($decoded['state'])) {
            return $decoded;
        }
    }
    return [
        'state' => $defaultState,
        'updatedAt' => gmdate('Y-m-d\TH:i:s.000\Z')
    ];
}

function saveCurrentState($pdo, $fallbackFile, $newState) {
    $nowSql = gmdate('Y-m-d H:i:s');
    $nowIso = gmdate('Y-m-d\TH:i:s.000\Z');
    $json = json_encode($newState, JSON_UNESCAPED_UNICODE);

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("INSERT INTO mp_app_state (id, state_json, updated_at) VALUES (1, :json, :now)
                ON DUPLICATE KEY UPDATE state_json = :json, updated_at = :now");
            $stmt->execute([':json' => $json, ':now' => $nowSql]);
        } catch (Exception $e) {}
    }

    @file_put_contents($fallbackFile, json_encode([
        'state' => $newState,
        'updatedAt' => $nowIso
    ], JSON_UNESCAPED_UNICODE));

    return $nowIso;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawBody = file_get_contents('php://input');
    $incoming = json_decode($rawBody, true);
    if (!is_array($incoming)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
        exit;
    }

    $updatedAt = saveCurrentState($pdo, $fallbackFile, $incoming);
    echo json_encode([
        'success' => true,
        'state' => $incoming,
        'updatedAt' => $updatedAt
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// GET request
$current = loadCurrentState($pdo, $fallbackFile, $defaultState);
if (isset($_GET['since']) && is_numeric($_GET['since'])) {
    $sinceMs = (float)$_GET['since'];
    $serverMs = strtotime($current['updatedAt']) * 1000;
    if ($serverMs <= $sinceMs) {
        echo json_encode([
            'success' => true,
            'notModified' => true,
            'updatedAt' => $current['updatedAt']
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

echo json_encode([
    'success' => true,
    'state' => $current['state'],
    'updatedAt' => $current['updatedAt']
], JSON_UNESCAPED_UNICODE);
