import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  Clipboard,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Loader2,
  Monitor,
  Network,
  RefreshCw,
  Save,
  Smartphone,
  TextCursorInput,
  UploadCloud,
  Wifi,
  X,
} from "lucide-react";
import { toast } from "sonner";

type FileDirection = "phone-to-pc" | "pc-to-phone";
type LanFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  direction: FileDirection;
};
type ConnectionStatus = "checking" | "ready" | "offline";
type PendingStatus = "queued" | "uploading" | "done" | "error";
type PendingFile = {
  id: string;
  file: File;
  progress: number;
  status: PendingStatus;
  error?: string;
};
type LanText = { text: string; updatedAt: string | null };

const directionLabels: Record<FileDirection, string> = {
  "phone-to-pc": "Телефон → ПК",
  "pc-to-phone": "ПК → телефон",
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function fileIcon(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "heic"].includes(extension ?? "")) return FileImage;
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(extension ?? "")) return FileVideo;
  if (["mp3", "wav", "m4a", "flac", "ogg"].includes(extension ?? "")) return FileAudio;
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension ?? "")) return FileArchive;
  if (["txt", "pdf", "doc", "docx", "xls", "xlsx", "csv"].includes(extension ?? "")) return FileText;
  return File;
}

function uploadFile(file: File, direction: FileDirection, onProgress: (progress: number) => void) {
  return new Promise<LanFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/lan/upload");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    xhr.setRequestHeader("X-Lan-Direction", direction);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new Error("Нет соединения с сервером"));
    xhr.onabort = () => reject(new Error("Передача отменена"));
    xhr.onload = () => {
      let payload: unknown;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload && typeof payload === "object") {
        resolve(payload as LanFile);
      } else {
        const message = payload && typeof payload === "object" && "error" in payload ? String(payload.error) : "Не удалось передать файл";
        reject(new Error(message));
      }
    };
    xhr.send(file);
  });
}

export default function Home() {
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [files, setFiles] = useState<LanFile[]>([]);
  const [direction, setDirection] = useState<FileDirection>("phone-to-pc");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [copied, setCopied] = useState(false);
  const [sharedText, setSharedText] = useState("");
  const [savedText, setSavedText] = useState<LanText>({ text: "", updatedAt: null });
  const [textSaving, setTextSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedTextRef = useRef<LanText>({ text: "", updatedAt: null });
  const uploadRunning = useRef(false);

  const refreshFiles = useCallback(async () => {
    try {
      const [statusResponse, filesResponse] = await Promise.all([
        fetch("/api/lan/status", { cache: "no-store" }),
        fetch("/api/lan/files", { cache: "no-store" }),
      ]);
      if (!statusResponse.ok || !filesResponse.ok) throw new Error("offline");
      setStatus("ready");
      setFiles((await filesResponse.json()) as LanFile[]);
    } catch {
      setStatus("offline");
    }
  }, []);

  const refreshText = useCallback(async () => {
    try {
      const response = await fetch("/api/lan/text", { cache: "no-store" });
      if (!response.ok) return;
      const value = (await response.json()) as LanText;
      const previousText = savedTextRef.current.text;
      savedTextRef.current = value;
      setSavedText(value);
      setSharedText((current) => current === previousText ? value.text : current);
    } catch {
      // Retry with the next polling cycle.
    }
  }, []);

  useEffect(() => {
    void refreshFiles();
    void refreshText();
    const interval = window.setInterval(() => {
      void refreshFiles();
      void refreshText();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [refreshFiles, refreshText]);

  const queuedCount = useMemo(() => pending.filter((item) => item.status === "queued").length, [pending]);
  const address = typeof window === "undefined" ? "" : window.location.href;

  function addFiles(selectedFiles: File[]) {
    if (!selectedFiles.length) return;
    setPending((current) => [
      ...current,
      ...selectedFiles.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        progress: 0,
        status: "queued" as PendingStatus,
      })),
    ]);
  }

  function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  }

  function removePending(id: string) {
    setPending((current) => current.filter((item) => item.id !== id));
  }

  async function startUpload() {
    if (uploadRunning.current || !queuedCount) return;
    uploadRunning.current = true;
    const queue = pending.filter((item) => item.status === "queued");
    let successful = 0;

    for (const item of queue) {
      setPending((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "uploading", progress: 0 } : entry));
      try {
        await uploadFile(item.file, direction, (progress) => {
          setPending((current) => current.map((entry) => entry.id === item.id ? { ...entry, progress } : entry));
        });
        successful += 1;
        setPending((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "done", progress: 100 } : entry));
      } catch (error) {
        setPending((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "error", error: error instanceof Error ? error.message : "Ошибка передачи" } : entry));
      }
    }

    uploadRunning.current = false;
    await refreshFiles();
    if (successful) toast.success(successful === 1 ? "Файл передан" : `Передано файлов: ${successful}`);
    window.setTimeout(() => setPending((current) => current.filter((item) => item.status !== "done")), 1000);
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Адрес скопирован");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Не удалось скопировать адрес");
    }
  }

  async function saveText() {
    setTextSaving(true);
    try {
      const response = await fetch("/api/lan/text", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sharedText }),
      });
      if (!response.ok) throw new Error("Не удалось сохранить текст");
      const value = (await response.json()) as LanText;
      savedTextRef.current = value;
      setSavedText(value);
      setSharedText(value.text);
      toast.success("Текст доступен на втором устройстве");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить текст");
    } finally {
      setTextSaving(false);
    }
  }

  const statusText = status === "ready" ? "Сервер готов" : status === "offline" ? "Нет соединения" : "Проверяем сеть";
  const StatusIcon = status === "offline" ? RefreshCw : Wifi;

  return (
    <div className="lan-shell">
      <header className="lan-header">
        <div className="brand-lockup" aria-label="LanBeam">
          <span className="brand-mark"><span /></span>
          <span className="brand-name">lanbeam</span>
        </div>
        <div className={`status-pill status-${status}`}>
          <span className="status-dot" />
          <span>{statusText}</span>
        </div>
      </header>

      <div className="network-strip">
        <div className="network-strip-icon"><Network size={18} /></div>
        <div className="network-strip-copy">
          <strong>Подключены к одной сети?</strong>
          <span>Откройте этот же адрес на втором устройстве — файлы останутся внутри вашей сети.</span>
        </div>
        <span className="network-chip">LOCAL / READY</span>
      </div>

      <main className="lan-layout">
        <aside className="lan-sidebar">
          <section className="connection-card">
            <div className="eyebrow"><span className="eyebrow-line" /> подключение</div>
            <h1>Файлы рядом,<br /><em>когда нужно.</em></h1>
            <p className="intro">Передавайте фотографии, документы и видео напрямую между телефоном и компьютером.</p>

            <div className="address-block">
              <div className="address-label"><span className="live-dot" /> адрес этой сессии</div>
              <code>{address || "Адрес появится после запуска"}</code>
              <button className="copy-button" onClick={copyAddress} type="button">
                {copied ? <Check size={15} /> : <Clipboard size={15} />}
                {copied ? "Скопировано" : "Скопировать адрес"}
              </button>
            </div>

            <div className="device-hint">
              <div className="device-icon"><Smartphone size={17} /></div>
              <div><strong>На телефоне</strong><span>Откройте адрес и выберите файлы</span></div>
            </div>
            <div className="device-connector"><span /><span /><span /></div>
            <div className="device-hint">
              <div className="device-icon device-icon-pc"><Monitor size={17} /></div>
              <div><strong>На компьютере</strong><span>Скачайте их из списка ниже</span></div>
            </div>
          </section>

          <section className="privacy-note">
            <CheckCircle2 size={17} />
            <div><strong>Только локальная сеть</strong><span>Без аккаунтов и облака. Файлы хранятся на этом сервере.</span></div>
          </section>
        </aside>

        <section className="lan-main">
          <div className="section-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> передача</div>
              <h2>Отправить файлы</h2>
            </div>
            <span className="file-count">{files.length} {files.length === 1 ? "файл" : "файлов"} в сессии</span>
          </div>

          <div className="direction-switch" role="group" aria-label="Направление передачи">
            <span className="direction-label">Я отправляю с</span>
            <button type="button" className={direction === "phone-to-pc" ? "direction-option active" : "direction-option"} onClick={() => setDirection("phone-to-pc")}>
              <Smartphone size={16} /> Телефона <ArrowDownToLine size={14} /> ПК
            </button>
            <button type="button" className={direction === "pc-to-phone" ? "direction-option active" : "direction-option"} onClick={() => setDirection("pc-to-phone")}>
              <Monitor size={16} /> ПК <ArrowDownToLine size={14} /> Телефон
            </button>
          </div>

          <div className="drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
            <div className="drop-icon"><UploadCloud size={27} /></div>
            <div className="drop-copy"><strong>Перетащите файлы сюда</strong><span>или выберите их на устройстве</span></div>
            <button type="button" className="primary-button" onClick={() => inputRef.current?.click()}>
              Выбрать файлы <ArrowUpFromLine size={17} />
            </button>
            <input ref={inputRef} type="file" multiple hidden onChange={handleInput} />
          </div>

          {pending.length > 0 && (
            <div className="queue-section">
              <div className="subsection-heading"><span>Очередь передачи</span><span>{pending.length} поз.</span></div>
              <div className="queue-list">
                {pending.map((item) => {
                  const Icon = fileIcon(item.file.name);
                  return (
                    <div className={`queue-item queue-${item.status}`} key={item.id}>
                      <div className="file-type-icon"><Icon size={18} /></div>
                      <div className="queue-file"><strong>{item.file.name}</strong><span>{formatBytes(item.file.size)} · {item.status === "uploading" ? `${item.progress}%` : item.status === "done" ? "Готово" : item.status === "error" ? item.error : "Ожидает передачи"}</span></div>
                      {item.status === "uploading" && <div className="mini-progress"><span style={{ width: `${item.progress}%` }} /></div>}
                      {item.status === "done" && <Check size={18} className="success-icon" />}
                      {item.status === "error" && <span className="error-icon">!</span>}
                      {(item.status === "queued" || item.status === "error") && <button className="icon-button" type="button" onClick={() => removePending(item.id)} aria-label="Удалить из очереди"><X size={17} /></button>}
                    </div>
                  );
                })}
              </div>
              <button type="button" className="send-button" disabled={!queuedCount || uploadRunning.current} onClick={() => void startUpload()}>
                {uploadRunning.current ? <Loader2 size={18} className="spin" /> : <ArrowUpFromLine size={18} />}
                {uploadRunning.current ? "Передаём…" : queuedCount ? `Передать ${queuedCount} ${queuedCount === 1 ? "файл" : "файла"}` : "Файлы переданы"}
              </button>
            </div>
          )}

          <section className="text-share-card">
            <div className="text-share-heading">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> быстрый обмен</div>
                <h2>Общий текст</h2>
              </div>
              <TextCursorInput size={20} className="text-share-icon" />
            </div>
            <p className="text-share-hint">Вставьте сообщение, ссылку или код — сохранённый текст появится на телефоне и ПК.</p>
            <textarea
              className="shared-textarea"
              value={sharedText}
              onChange={(event) => setSharedText(event.target.value)}
              placeholder="Напишите или вставьте текст здесь…"
              maxLength={10000}
              rows={5}
            />
            <div className="text-share-actions">
              <span>{sharedText.length} / 10 000 символов{savedText.updatedAt ? ` · обновлено ${formatDate(savedText.updatedAt)}` : ""}</span>
              <button type="button" className="save-text-button" onClick={() => void saveText()} disabled={textSaving}>
                {textSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                {textSaving ? "Сохраняем…" : "Сохранить текст"}
              </button>
            </div>
          </section>

          <div className="history-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> на сервере</div><h2>Последние файлы</h2></div>
            <button type="button" className="refresh-button" onClick={() => void refreshFiles()}><RefreshCw size={15} /> Обновить</button>
          </div>

          <div className="history-list">
            {files.length === 0 ? (
              <div className="empty-history"><div className="empty-icon"><File size={24} /></div><strong>Здесь появятся переданные файлы</strong><span>Выберите файл выше — он будет доступен на втором устройстве.</span></div>
            ) : files.map((file) => {
              const Icon = fileIcon(file.name);
              return (
                <div className="history-item" key={file.id}>
                  <div className="file-type-icon"><Icon size={18} /></div>
                  <div className="history-file"><strong title={file.name}>{file.name}</strong><span>{formatBytes(file.size)} · {formatDate(file.uploadedAt)}</span></div>
                  <span className={`direction-tag ${file.direction === "pc-to-phone" ? "tag-pc" : ""}`}>{directionLabels[file.direction]}</span>
                  <a className="download-button" href={`/api/lan/files/${file.id}/download`} download={file.name} aria-label={`Скачать ${file.name}`}><ArrowDownToLine size={17} /><span>Скачать</span></a>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="lan-footer"><span>LANBEAM / PRIVATE TRANSFER</span><span>Файлы не покидают вашу сеть</span></footer>
    </div>
  );
}
