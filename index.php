<?php

ini_set('memory_limit', '32M');

// Определение версии NFQWS
define('NFQWS2', file_exists('/opt/usr/bin/nfqws2') || file_exists('/usr/bin/nfqws2'));
define('ROOT_DIR', (file_exists('/opt/usr/bin/nfqws2') || file_exists('/opt/usr/bin/nfqws')) ? '/opt' : '');
const SCRIPT_NAME = ROOT_DIR ? (NFQWS2 ? 'S51nfqws2' : 'S51nfqws') : (NFQWS2 ? 'nfqws2-keenetic' : 'nfqws-keenetic');
const CONF_DIR = NFQWS2 ? '/etc/nfqws2' : '/etc/nfqws';
const LISTS_DIR = NFQWS2 ? '/etc/nfqws2/lists' : '/etc/nfqws';
const LOGS_DIR = '/var/log';

// Функция для получения версии nfqws/nfqws2
function getNfqwsVersion() {
    $version = 'unknown';
    
    if (NFQWS2) {
        // Проверяем пакет opkg для nfqws2
        exec("opkg list-installed | grep nfqws2-keenetic", $output);
        if (!empty($output)) {
            foreach ($output as $line) {
                if (preg_match('/nfqws2-keenetic\s+-\s+([\d\.]+)/', $line, $matches)) {
                    $version = $matches[1];
                    break;
                }
            }
        }
        
        // Проверяем пакет apk для nfqws2
        if ($version === 'unknown') {
            exec("apk list --installed | grep nfqws2-keenetic", $output);
            if (!empty($output)) {
                foreach ($output as $line) {
                    if (preg_match('/nfqws2-keenetic-([\d\.]+)/', $line, $matches)) {
                        $version = $matches[1];
                        break;
                    }
                }
            }
        }
    } else {
        // Проверяем пакет opkg для nfqws
        exec("opkg list-installed | grep nfqws-keenetic", $output);
        if (!empty($output)) {
            foreach ($output as $line) {
                if (preg_match('/nfqws-keenetic\s+-\s+([\d\.]+)/', $line, $matches)) {
                    $version = $matches[1];
                    break;
                }
            }
        }
        
        // Проверяем пакет apk для nfqws
        if ($version === 'unknown') {
            exec("apk list --installed | grep nfqws-keenetic", $output);
            if (!empty($output)) {
                foreach ($output as $line) {
                    if (preg_match('/nfqws-keenetic-([\d\.]+)/', $line, $matches)) {
                        $version = $matches[1];
                        break;
                    }
                }
            }
        }
    }
    
    return $version;
}

/**
 * Делает GET, проверяет финальный HTTP-статус 2xx и то, что тело реально начало приходить.
 * Читает максимум первые $limitKb КБ и обрывает соединение после этого.
 * 204 No Content считается OK даже без тела.
 */
function checkResponseBodyReadable(string $url, int $limitKb = 50): bool {
    $limitBytes = $limitKb * 1024;

    $received = 0;
    $statusCode = null;
    $statusOk = false;
    $bodyStarted = false;
    $reachedLimit = false;

    $ch = curl_init($url);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_CONNECTTIMEOUT => 5,
        // Helpful on embedded/POSIX systems so timeouts don't rely on signals
        CURLOPT_NOSIGNAL => 1,

        // Читаем статус (последний, с учётом редиректов)
        CURLOPT_HEADERFUNCTION => function ($ch, $header) use (&$statusOk, &$statusCode) {
            if (preg_match('#^HTTP/\d+\.\d+\s+(\d+)#', $header, $m)) {
                $code = (int)$m[1];
                $statusCode = $code;
                $statusOk = ($code >= 200 && $code < 300);
            }
            return strlen($header);
        },

        // Читаем тело, но не сохраняем
        CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (
            &$received,
            $limitBytes,
            &$statusOk,
            &$bodyStarted,
            &$reachedLimit
        ) {
            // Если статус не 2xx — дальше тело читать не надо
            if (!$statusOk) {
                return 0;
            }

            $len = strlen($chunk);
            if ($len > 0) {
                $bodyStarted = true;
                $received += $len;
            }

            // если дошли до лимита — обрываем
            if ($received >= $limitBytes) {
                $reachedLimit = true;
                return 0;
            }

            return $len;
        },

        // Если соединение "подвисло" и не качает — быстрее возвращаемся
        CURLOPT_LOW_SPEED_LIMIT => 1,  // bytes/sec
        CURLOPT_LOW_SPEED_TIME => 10,  // seconds
    ]);

    curl_exec($ch);
    curl_close($ch);

    // Считаем запрос успешным, если мы вообще получили HTTP-ответ (любой код: 2xx/3xx/4xx/5xx).
    // Неуспех — это когда ответа нет совсем (DNS не резолвится, таймаут, нет соединения и т.п.),
    // в этом случае статусная строка не будет получена и $statusCode останется null.
    return $statusCode !== null;
}

function getFiles(): array {
    $result = [];

    // Конфигурационные файлы
    $confs = array_filter(glob(ROOT_DIR . CONF_DIR . '/*'), function ($file) {
        return is_file($file) && preg_match('/\.(conf|conf-opkg|conf-old|apk-new)$/i', $file);
    });
    $baseConfs = array_map(fn($file) => basename($file), $confs);
    $result = array_merge($result, $baseConfs);

    // Списки
    $lists = array_filter(glob(ROOT_DIR . LISTS_DIR . '/*'), function ($file) {
        return is_file($file) && preg_match('/\.(list|list-opkg|list-old|apk-new)$/i', $file);
    });
    $baseLists = array_map(fn($file) => basename($file), $lists);
    $result = array_merge($result, $baseLists);

    // Логи
    $logs = array_filter(glob(ROOT_DIR . LOGS_DIR . '/nfqws*'), function ($file) {
        return is_file($file) && preg_match('/\.log$/i', $file);
    });
    $baseLogs = array_map(fn($file) => basename($file), $logs);
    $result = array_merge($result, $baseLogs);

    function getSortPriority(string $filename): int {
        $priority = [
            'nfqws2.conf' => -81,
            'nfqws.conf' => -80,
            'user.list' => -54,
            'exclude.list' => -53,
            'auto.list' => -52,
            'ipset.list' => -51,
            'ipset_exclude.list' => -50,
            'nfqws2.log' => -11,
            'nfqws.log' => -10,
            'nfqws2-debug.log' => -9,
            'nfqws-debug.log' => -8,
        ];

        if (array_key_exists($filename, $priority)) {
            return $priority[$filename];
        }
        if (str_ends_with($filename, '.conf')) {
            return -70;
        }
        if (str_ends_with($filename, '.list')) {
            return -40;
        }
        if (str_ends_with($filename, '.log')) {
            return 0;
        }
        return 10;
    }

    usort($result, fn($a, $b) => getSortPriority($a) - getSortPriority($b));

    return $result;
}

function getFileContent(string $filename): string {
    $filename = basename($filename);
    if (preg_match('/\.(list|list-opkg|list-old|apk-new)$/i', $filename)) {
        $path = ROOT_DIR . LISTS_DIR . '/' . basename($filename);
    } else if (preg_match('/\.log$/i', $filename)) {
        $path = ROOT_DIR . LOGS_DIR . '/' . basename($filename);
    } else {
        $path = ROOT_DIR . CONF_DIR . '/' . basename($filename);
    }

    if (file_exists($path)) {
        return file_get_contents($path);
    }
    return '';
}

function getLogContent(string $filename): string {
    $filename = basename($filename);
    $file = file(ROOT_DIR . LOGS_DIR . '/' . $filename);
    $file = array_reverse($file);
    return implode("", $file);
}

function saveFile(string $filename, string $content): bool {
    $filename = basename($filename);
    if (preg_match('/\.(list|list-opkg|list-old|apk-new)$/i', $filename)) {
        $file = ROOT_DIR . LISTS_DIR . '/' . $filename;
    } elseif (preg_match('/\.log$/i', $filename)) {
        $file = ROOT_DIR . LOGS_DIR . '/' . $filename;
    } else {
        $file = ROOT_DIR . CONF_DIR . '/' . $filename;
    }
    
    // Создаем директорию если она не существует
    $dir = dirname($file);
    if (!file_exists($dir)) {
        mkdir($dir, 0755, true);
    }
    
    // Нормализуем строку
    $content = str_replace(array("\r\n", "\r", "\n"), "\n", $content);
    $content = preg_replace("/\n{3,}/", "\n\n", $content);
    $lastChar = substr($content, -1);
    if ($lastChar !== "\n" && !empty($content)) {
        $content .= "\n";
    }
    
    return file_put_contents($file, $content) !== false;
}

function removeFile(string $filename): bool {
    $filename = basename($filename);
    
    // Защищенные файлы, которые нельзя удалять
    $protectedFiles = [
        'nfqws2.conf',
        'nfqws.conf',
        'user.list',
        'exclude.list',
        'auto.list',
        'ipset.list',
        'ipset_exclude.list',
        'nfqws2.log',
        'nfqws.log',
        'nfqws2-debug.log',
        'nfqws-debug.log'
    ];
    
    // Проверяем, является ли файл защищенным
    if (in_array($filename, $protectedFiles)) {
        return false;
    }
    
    if (preg_match('/\.(list|list-opkg|list-old|apk-new)$/i', $filename)) {
        $file = ROOT_DIR . LISTS_DIR . '/' . $filename;
    } else if (preg_match('/\.log$/i', $filename)) {
        $file = ROOT_DIR . LOGS_DIR . '/' . $filename;
    } else {
        $file = ROOT_DIR . CONF_DIR . '/' . $filename;
    }
    
    if (file_exists($file)) {
        return unlink($file);
    } else {
        return false;
    }
}

function nfqwsServiceStatus(): array {
    $output = null;
    $path = ROOT_DIR . "/etc/init.d/" . SCRIPT_NAME;
    if (!file_exists($path)) {
        return array('service' => false, 'status' => 1);
    }

    exec($path . " status", $output);
    $running = str_contains($output[0] ?? '', 'is running');
    return array('service' => $running, 'status' => 0);
}

function nfqwsServiceAction(string $action): array {
    $output = null;
    $retval = null;
    exec(ROOT_DIR . "/etc/init.d/" . SCRIPT_NAME . " $action", $output, $retval);
    return array('output' => $output, 'status' => $retval);
}

function opkgUpgradeAction(): array {
    $output = null;
    $retval = null;
    if (NFQWS2) {
        exec("opkg update && opkg upgrade nfqws2-keenetic nfqws-keenetic-web", $output, $retval);
    } else {
        exec("opkg update && opkg upgrade nfqws-keenetic nfqws-keenetic-web", $output, $retval);
    }
    if (empty($output)) {
        $output[] = 'Nothing to update';
    }
    return array('output' => $output, 'status' => $retval);
}

function apkUpgradeAction(): array {
    $output = null;
    $retval = null;
    if (NFQWS2) {
        exec("apk --update-cache add nfqws2-keenetic nfqws-keenetic-web", $output, $retval);
    } else {
        exec("apk --update-cache add nfqws-keenetic nfqws-keenetic-web", $output, $retval);
    }
    if (empty($output)) {
        $output[] = 'Nothing to update';
    }
    return array('output' => $output, 'status' => $retval);
}

function upgradeAction(): array {
    return file_exists('/usr/bin/apk') ? apkUpgradeAction() : opkgUpgradeAction();
}

function authenticate($username, $password): bool {
    $passwdFile = ROOT_DIR . '/etc/passwd';
    $shadowFile = ROOT_DIR . '/etc/shadow';

    $users = file(file_exists($shadowFile) ? $shadowFile : $passwdFile);
    $user = preg_grep("/^" . preg_quote($username, '/') . ":/", $users);

    if ($user) {
        list(, $passwdInDB) = explode(':', array_pop($user));
        if (empty($passwdInDB)) {
            return empty($password);
        }
        if (crypt($password, $passwdInDB) == $passwdInDB) {
            return true;
        }
    }

    return false;
}

function main(): void {
    if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(302);
        header('Location: index.html');
        exit();
    }

    session_start();
    if (!isset($_SESSION['auth']) || !$_SESSION['auth']) {
        if ($_POST['cmd'] !== 'login' || !isset($_POST['user']) || !isset($_POST['password']) || !authenticate($_POST['user'], $_POST['password'])) {
            http_response_code(401);
            exit();
        } else {
            $_SESSION['auth'] = true;
        }
    }

    switch ($_POST['cmd']) {
        case 'status':
            $status = nfqwsServiceStatus();
            $response = array('status' => $status['status'], 'service' => $status['service'], 'nfqws2' => NFQWS2, 'version' => getNfqwsVersion());
            break;

        case 'filenames':
            $files = getFiles();
            $status = nfqwsServiceStatus();
            $response = array('status' => 0, 'files' => $files, 'service' => $status['service'], 'nfqws2' => NFQWS2, 'version' => getNfqwsVersion());
            break;

        case 'filecontent':
            if (str_ends_with($_POST['filename'], '.log')) {
                $content = getLogContent($_POST['filename']);
            } else {
                $content = getFileContent($_POST['filename']);
            }
            $response = array('status' => 0, 'content' => $content, 'filename' => $_POST['filename']);
            break;

        case 'filesave':
            $result = saveFile($_POST['filename'], $_POST['content']);
            $response = array('status' => $result ? 0 : 1, 'filename' => $_POST['filename']);
            break;

        case 'fileremove':
            $result = removeFile($_POST['filename']);
            $response = array('status' => $result ? 0 : 1, 'filename' => $_POST['filename']);
            break;

        case 'reload':
        case 'restart':
        case 'stop':
        case 'start':
            $response = nfqwsServiceAction($_POST['cmd']);
            break;

        case 'upgrade':
            $response = upgradeAction();
            break;

        case 'login':
            $response = array('status' => 0);
            break;

        case 'logout':
            $_SESSION['auth'] = false;
            $response = array('status' => 0);
            break;

        case 'getversion':
            $response = array('status' => 0, 'version' => getNfqwsVersion(), 'nfqws2' => NFQWS2);
            break;

        case 'check':
            $response = array('status' => 0, 'result' => checkResponseBodyReadable($_POST['url']));
            break;

        default:
            http_response_code(405);
            exit();
    }

    header('Content-Type: application/json; charset=utf-8');
    http_response_code(200);
    echo json_encode($response);
    exit();
}

main();