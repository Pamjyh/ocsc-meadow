import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  addStoredPhoto,
  clearAllStoredPhotos,
  compressImageToJpeg,
  deleteStoredPhoto,
  listStoredPhotos,
  updateStoredPhotoCaption,
  type StoredPhoto,
} from '../photoDb';

interface PhotoItemView {
  id: string;
  url: string;
  caption: string;
  createdAt: number;
}

interface PhotoCollectionCardProps {
  config: Record<string, unknown>;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}

export function PhotoCollectionCard({
  config,
  onUpdateConfig,
}: PhotoCollectionCardProps) {
  const autoPlay = config.autoPlay !== false;
  const intervalSec =
    typeof config.intervalSec === 'number' && config.intervalSec >= 3
      ? config.intervalSec
      : 6;

  const [photos, setPhotos] = useState<PhotoItemView[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const urlsRef = useRef<string[]>([]);
  const mountedRef = useRef(true);

  const replacePhotoViews = useCallback((records: StoredPhoto[]) => {
    if (!mountedRef.current) return;
    const prevUrls = urlsRef.current;
    const nextViews = records.map((rec) => ({
      id: rec.id,
      url: URL.createObjectURL(rec.blob),
      caption: rec.caption,
      createdAt: rec.createdAt,
    }));
    urlsRef.current = nextViews.map((v) => v.url);
    setPhotos(nextViews);
    prevUrls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    listStoredPhotos()
      .then((records) => {
        if (!active) return;
        replacePhotoViews(records);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setErrorMsg(err instanceof Error ? err.message : 'ไม่สามารถโหลดคลังรูปภาพได้');
        setLoading(false);
      });

    return () => {
      active = false;
      mountedRef.current = false;
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = [];
    };
  }, [replacePhotoViews]);

  useEffect(() => {
    if (photos.length === 0) {
      setCurrentIndex(0);
      return;
    }
    if (currentIndex >= photos.length) {
      setCurrentIndex(photos.length - 1);
    }
  }, [photos.length, currentIndex]);

  useEffect(() => {
    if (!autoPlay || lightboxOpen || photos.length <= 1) return;
    const id = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }, intervalSec * 1000);
    return () => window.clearInterval(id);
  }, [autoPlay, intervalSec, lightboxOpen, photos.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
        setConfirmClear(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [lightboxOpen]);

  const currentPhoto = photos[currentIndex] ?? null;

  const openLightbox = () => {
    if (!currentPhoto) return;
    setCaptionDraft(currentPhoto.caption);
    setConfirmClear(false);
    setLightboxOpen(true);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setErrorMsg(null);

    let skipped = 0;
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          skipped += 1;
          continue;
        }
        try {
          const jpegBlob = await compressImageToJpeg(file, 1200, 0.82);
          await addStoredPhoto(jpegBlob, '');
        } catch (err) {
          if (err instanceof Error && err.message.includes('เต็ม')) {
            throw err;
          }
          skipped += 1;
        }
      }
      const updated = await listStoredPhotos();
      replacePhotoViews(updated);
      if (updated.length > 0) {
        setCurrentIndex(updated.length - 1);
      }
      if (skipped > 0) {
        setErrorMsg(`ข้ามไฟล์ที่ไม่ใช่รูปภาพหรือไม่รองรับ ${skipped} ไฟล์`);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'ไม่สามารถอัปโหลดรูปภาพได้');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveCaption = async () => {
    if (!currentPhoto) return;
    const trimmed = captionDraft.trim();
    if (trimmed === currentPhoto.caption) return;
    try {
      await updateStoredPhotoCaption(currentPhoto.id, trimmed);
      if (!mountedRef.current) return;
      setPhotos((prev) =>
        prev.map((p) => (p.id === currentPhoto.id ? { ...p, caption: trimmed } : p)),
      );
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setErrorMsg(err instanceof Error ? err.message : 'บันทึกคำบรรยายไม่สำเร็จ');
    }
  };

  const handleDeleteCurrent = async () => {
    if (!currentPhoto) return;
    try {
      await deleteStoredPhoto(currentPhoto.id);
      const updated = await listStoredPhotos();
      replacePhotoViews(updated);
      if (updated.length === 0) {
        setLightboxOpen(false);
      } else {
        const nextIdx = Math.min(currentIndex, updated.length - 1);
        setCurrentIndex(nextIdx);
        setCaptionDraft(updated[nextIdx]?.caption ?? '');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'ลบรูปไม่สำเร็จ');
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllStoredPhotos();
      replacePhotoViews([]);
      setLightboxOpen(false);
      setConfirmClear(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'ล้างคลังรูปไม่สำเร็จ');
    }
  };

  return (
    <div className="glass-card widget-card photo-card">
      <div className="widget-card-head">
        <div>
          <h2 className="widget-card-title">🖼️ คอลเลกชันรูปภาพ</h2>
          <p className="widget-card-sub">
            {photos.length > 0
              ? `${currentIndex + 1}/${photos.length} รูป · เก็บเป็นส่วนตัวบนเครื่องนี้`
              : 'เพิ่มรูปความทรงจำหรือรูปสบายตาไว้ดูพักสายตา'}
          </p>
        </div>
        <div className="photo-head-actions">
          {photos.length > 1 && (
            <button
              type="button"
              className={`widget-mini-pill${autoPlay ? ' widget-mini-pill--active' : ''}`}
              onClick={() => onUpdateConfig({ autoPlay: !autoPlay })}
              title="เปิด/ปิดสไลด์โชว์อัตโนมัติ"
            >
              {autoPlay ? 'สไลด์: เปิด' : 'สไลด์: ปิด'}
            </button>
          )}
          <button
            type="button"
            className="widget-mini-pill widget-mini-pill--primary"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? 'กำลังย่อรูป...' : '+ เพิ่มรูป'}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFileChange}
      />

      {errorMsg && <p className="widget-error-text">{errorMsg}</p>}

      {loading ? (
        <div className="photo-empty">กำลังโหลดคลังรูปภาพ...</div>
      ) : !currentPhoto ? (
        <button
          type="button"
          className="photo-empty photo-dropzone"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="photo-empty-icon" aria-hidden="true">
            🌿
          </span>
          <span className="photo-empty-label">แตะเพื่อเลือกรูปจากเครื่อง</span>
          <span className="photo-empty-hint">
            ย่อขนาดอัตโนมัติ เก็บได้หลายสิบรูป และไม่หายแม้ซ่อนหน้าต่างนี้
          </span>
        </button>
      ) : (
        <div className="photo-frame-wrap">
          <button
            type="button"
            className="photo-frame-btn"
            onClick={openLightbox}
            title="แตะเพื่อดูรูปเต็มหรือแก้ไขคำบรรยาย"
          >
            <img
              src={currentPhoto.url}
              alt={currentPhoto.caption || 'รูปภาพในคอลเลกชัน'}
              className="photo-frame-img"
            />
            {currentPhoto.caption && (
              <div className="photo-caption-bar">{currentPhoto.caption}</div>
            )}
          </button>

          {photos.length > 1 && (
            <div className="photo-nav-row">
              <button
                type="button"
                className="photo-nav-btn"
                onClick={() =>
                  setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length)
                }
                aria-label="รูปก่อนหน้า"
              >
                ‹
              </button>
              <button
                type="button"
                className="photo-nav-btn"
                onClick={() => setCurrentIndex((prev) => (prev + 1) % photos.length)}
                aria-label="รูปถัดไป"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}

      {lightboxOpen && currentPhoto && (
        <div
          className="widget-gallery-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="ดูรูปภาพขนาดเต็ม"
          onClick={() => {
            setLightboxOpen(false);
            setConfirmClear(false);
          }}
        >
          <div
            className="glass-card photo-lightbox"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="photo-lightbox-top">
              <span className="widget-card-title">
                รูปที่ {currentIndex + 1} / {photos.length}
              </span>
              <button
                type="button"
                className="widget-pill-btn"
                onClick={() => {
                  setLightboxOpen(false);
                  setConfirmClear(false);
                }}
              >
                ปิด
              </button>
            </div>

            <div className="photo-lightbox-stage">
              <img
                src={currentPhoto.url}
                alt={currentPhoto.caption || 'รูปภาพขนาดเต็ม'}
                className="photo-lightbox-img"
              />
            </div>

            <div className="photo-lightbox-caption-row">
              <input
                type="text"
                className="widget-input"
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                onBlur={handleSaveCaption}
                placeholder="เพิ่มคำบรรยายใต้รูป (เช่น วันไปเที่ยว, เป้าหมายปีนี้)..."
                maxLength={120}
              />
              <button
                type="button"
                className="widget-pill-btn widget-pill-btn--primary"
                onClick={handleSaveCaption}
              >
                บันทึก
              </button>
            </div>

            <div className="photo-lightbox-actions">
              <button
                type="button"
                className="widget-edit-btn widget-edit-btn--danger"
                onClick={handleDeleteCurrent}
              >
                ลบรูปนี้
              </button>

              {confirmClear ? (
                <div className="photo-confirm-row">
                  <span>ยืนยันล้างทั้งหมด?</span>
                  <button
                    type="button"
                    className="widget-edit-btn widget-edit-btn--danger"
                    onClick={handleClearAll}
                  >
                    ยืนยันล้าง
                  </button>
                  <button
                    type="button"
                    className="widget-edit-btn"
                    onClick={() => setConfirmClear(false)}
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="widget-edit-btn"
                  onClick={() => setConfirmClear(true)}
                >
                  ล้างรูปทั้งหมด
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
