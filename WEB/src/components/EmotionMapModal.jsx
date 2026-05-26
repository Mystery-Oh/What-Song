import React, { useEffect, useMemo, useRef, useState } from "react";
import "./EmotionMapModal.css";

function quadrantLabel(x, y) {
    if (x >= 0 && y >= 0) return "고각성 · 긍정";
    if (x < 0 && y >= 0) return "고각성 · 부정";
    if (x < 0 && y < 0) return "저각성 · 부정";
    return "저각성 · 긍정";
}

function moodSummary(x, y) {
    if (x >= 45 && y >= 45) return "설렘 / 흥분";
    if (x >= 0 && y >= 0) return "즐거움 / 활기";
    if (x < 0 && y >= 35) return "긴장 / 불안";
    if (x < 0 && y >= 0) return "집중 / 경계";
    if (x < 0 && y < 0) return "우울 / 지침";
    if (x >= 0 && y < 0) return "편안 / 나른";
    return "중립";
}

function distance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function truncateText(text, max = 22) {
    if (!text) return "";
    return text.length > max ? `${text.slice(0, max)}...` : text;
}

function TooltipBubble({ point, toSvg, size, tone = "normal", title = null }) {
    if (!point) return null;

    const pos = toSvg(point.x, point.y);
    const bubbleWidth = 185;
    const bubbleHeight = 52;
    const bubbleGap = 16;

    const placeLeft = pos.cx > size * 0.62;

    const bubbleX = placeLeft
        ? pos.cx - bubbleWidth - 42
        : pos.cx + bubbleGap;

    const bubbleY = pos.cy - 70;

    const lineStartX = placeLeft ? pos.cx - 10 : pos.cx + 10;
    const lineEndX = placeLeft ? pos.cx - 42 : pos.cx + bubbleGap;

    const palette =
        tone === "highlight"
            ? {
                fill: "rgba(15,23,42,0.88)",
                stroke: "rgba(255,255,255,0.16)",
            }
            : tone === "selected"
                ? {
                    fill: "rgba(88,28,135,0.92)",
                    stroke: "rgba(216,180,254,0.45)",
                }
                : tone === "hover"
                    ? {
                        fill: "rgba(30,41,59,0.94)",
                        stroke: "rgba(244,114,182,0.38)",
                    }
                    : {
                        fill: "rgba(15,23,42,0.92)",
                        stroke: "rgba(255,255,255,0.16)",
                    };

    const label = title || point.title;

    return (
        <g>
            <line
                x1={lineStartX}
                y1={pos.cy - 10}
                x2={lineEndX}
                y2={pos.cy - 40}
                stroke="rgba(255,255,255,0.72)"
            />

            <rect
                x={bubbleX}
                y={bubbleY}
                rx="12"
                ry="12"
                width={bubbleWidth}
                height={bubbleHeight}
                fill={palette.fill}
                stroke={palette.stroke}
            />

            <text
                x={bubbleX + 12}
                y={bubbleY + 20}
                fill="white"
                fontSize="12"
                fontWeight="600"
            >
                {truncateText(label, 20)}
            </text>

            <text
                x={bubbleX + 12}
                y={bubbleY + 37}
                fill="rgba(255,255,255,0.72)"
                fontSize="11"
            >
                {truncateText(point.artist, 24)}
            </text>
        </g>
    );
}

function EmotionCircle({
                           points,
                           highlighted,
                           selectedPoint,
                           hoveredPoint,
                           onSelectPoint,
                           onHoverPoint,
                       }) {
    const size = 460;
    const center = size / 2;
    const radius = 180;

    const toSvg = (x, y) => ({
        cx: center + (x / 100) * radius,
        cy: center - (y / 100) * radius,
    });

    const highlightedPos = highlighted ? toSvg(highlighted.x, highlighted.y) : null;

    return (
        <div className="emotion-card">
            <div className="emotion-card-header">
                <div>
                    <p className="emotion-card-subtitle">러셀 원형 감정 모델</p>
                    <h3 className="emotion-card-title">검색곡과 전체 곡 분포</h3>
                </div>
                <span className="emotion-badge">검색곡 강조</span>
            </div>

            <svg viewBox={`0 0 ${size} ${size}`} className="emotion-chart">
                <defs>
                    <radialGradient id="emotionBgGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
                    </radialGradient>
                </defs>

                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="url(#emotionBgGlow)"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="1.5"
                />
                <circle
                    cx={center}
                    cy={center}
                    r={radius * 0.66}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="6 6"
                />
                <circle
                    cx={center}
                    cy={center}
                    r={radius * 0.33}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="4 6"
                />

                <line
                    x1={center - radius}
                    y1={center}
                    x2={center + radius}
                    y2={center}
                    stroke="rgba(255,255,255,0.18)"
                />
                <line
                    x1={center}
                    y1={center - radius}
                    x2={center}
                    y2={center + radius}
                    stroke="rgba(255,255,255,0.18)"
                />

                <text
                    x={center}
                    y={30}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.82)"
                    fontSize="13"
                >
                    각성도 ↑
                </text>
                <text
                    x={center}
                    y={size - 14}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.82)"
                    fontSize="13"
                >
                    각성도 ↓
                </text>
                <text
                    x={size - 26}
                    y={center - 8}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.82)"
                    fontSize="13"
                >
                    긍정
                </text>
                <text
                    x={28}
                    y={center - 8}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.82)"
                    fontSize="13"
                >
                    부정
                </text>

                {points.map((point) => {
                    const pos = toSvg(point.x, point.y);
                    const isSelected = selectedPoint?.id === point.id;
                    const isHovered = hoveredPoint?.id === point.id;
                    const isHighlighted = highlighted?.id === point.id;

                    const pointFill = isHighlighted
                        ? "rgba(34,211,238,0.95)"
                        : isHovered
                            ? "rgba(244,114,182,0.95)"
                            : isSelected
                                ? "rgba(168,85,247,0.95)"
                                : "rgba(255,255,255,0.78)";

                    const pointStroke = isHighlighted
                        ? "white"
                        : isHovered
                            ? "rgba(255,255,255,0.95)"
                            : isSelected
                                ? "rgba(233,213,255,0.95)"
                                : "rgba(125,211,252,0.9)";

                    const pointRadius = isHighlighted ? 8.5 : isHovered ? 9 : isSelected ? 7.5 : 5;

                    return (
                        <g
                            key={point.id}
                            onClick={() => onSelectPoint(point)}
                            onMouseEnter={() => onHoverPoint(point)}
                            onMouseLeave={() => onHoverPoint(null)}
                            style={{ cursor: "pointer" }}
                            opacity={isSelected || isHovered || isHighlighted ? 1 : 0.72}
                        >
                            {isHovered && !isHighlighted && (
                                <circle
                                    cx={pos.cx}
                                    cy={pos.cy}
                                    r={18}
                                    fill="rgba(244,114,182,0.16)"
                                />
                            )}

                            {isSelected && !isHovered && !isHighlighted && (
                                <circle
                                    cx={pos.cx}
                                    cy={pos.cy}
                                    r={16}
                                    fill="rgba(168,85,247,0.16)"
                                />
                            )}

                            <circle
                                cx={pos.cx}
                                cy={pos.cy}
                                r={pointRadius}
                                fill={pointFill}
                                stroke={pointStroke}
                                strokeWidth={isHovered || isHighlighted ? 3 : isSelected ? 2.5 : 1}
                            />
                        </g>
                    );
                })}

                {highlighted && highlightedPos && (
                    <>
                        <circle
                            cx={highlightedPos.cx}
                            cy={highlightedPos.cy}
                            r={24}
                            fill="rgba(34,211,238,0.12)"
                        />
                        <circle
                            cx={highlightedPos.cx}
                            cy={highlightedPos.cy}
                            r={15}
                            fill="rgba(34,211,238,0.18)"
                        />
                        <circle
                            cx={highlightedPos.cx}
                            cy={highlightedPos.cy}
                            r={8.5}
                            fill="rgba(34,211,238,0.95)"
                            stroke="white"
                            strokeWidth="2.5"
                        />

                        <TooltipBubble
                            point={highlighted}
                            toSvg={toSvg}
                            size={size}
                            tone="highlight"
                            title="검색한 곡"
                        />
                    </>
                )}

                {hoveredPoint && hoveredPoint.id !== highlighted?.id && (
                    <TooltipBubble
                        point={hoveredPoint}
                        toSvg={toSvg}
                        size={size}
                        tone="hover"
                    />
                )}

                {!hoveredPoint &&
                    selectedPoint &&
                    selectedPoint.id !== highlighted?.id && (
                        <TooltipBubble
                            point={selectedPoint}
                            toSvg={toSvg}
                            size={size}
                            tone="selected"
                        />
                    )}
            </svg>
        </div>
    );
}

export default function EmotionMapModal({
                                            open,
                                            onClose,
                                            searchedTrack,
                                            tracks,
                                            title = "감정 분포 보기",
                                        }) {
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const trackItemRefs = useRef({});

    useEffect(() => {
        if (tracks?.length) {
            setSelectedPoint(tracks[0]);
        } else {
            setSelectedPoint(null);
        }
        setHoveredPoint(null);
    }, [tracks, open]);

    useEffect(() => {
        if (!selectedPoint?.id) return;

        const target = trackItemRefs.current[selectedPoint.id];

        if (target) {
            target.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }, [selectedPoint]);

    const nearestTracks = useMemo(() => {
        if (!searchedTrack || !tracks?.length) return [];

        return [...tracks]
            .map((track) => ({
                ...track,
                dist: distance(track, searchedTrack),
            }))
            .sort((a, b) => a.dist - b.dist)
            // .slice(0, 5);
    }, [tracks, searchedTrack]);

    const distributionInfo = useMemo(() => {
        if (!searchedTrack || !tracks?.length) {
            return {
                zone: "-",
                emotion: "-",
                sameQuadrant: 0,
            };
        }

        const sameQuadrant = tracks.filter(
            (track) => quadrantLabel(track.x, track.y) === quadrantLabel(searchedTrack.x, searchedTrack.y)
        ).length;

        return {
            zone: quadrantLabel(searchedTrack.x, searchedTrack.y),
            emotion: moodSummary(searchedTrack.x, searchedTrack.y),
            sameQuadrant,
        };
    }, [tracks, searchedTrack]);

    if (!open) return null;

    return (
        <div className="emotion-modal-overlay" onClick={onClose}>
            <div className="emotion-modal" onClick={(e) => e.stopPropagation()}>
                <div className="emotion-modal-header">
                    <div>
                        <p className="emotion-modal-top">공용 감정 분포 모달</p>
                        <h2>{title}</h2>
                    </div>
                    <button className="emotion-close-btn" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="emotion-modal-body">
                    {/*<div className="emotion-top-box">*/}
                    {/*    <p className="emotion-top-badge">뮤직조아 · 감정 기반 추천 시각화</p>*/}
                    {/*    <h3>검색곡의 위치와 다른 곡들의 분포를 함께 보여주는 UI</h3>*/}
                    {/*    <p className="emotion-top-desc">*/}
                    {/*        검색곡은 시안색으로 고정 표시되고, 다른 곡은 hover 시 말풍선이 뜨며*/}
                    {/*        클릭하면 보라색으로 선택 상태가 유지됩니다.*/}
                    {/*    </p>*/}
                    {/*</div>*/}

                    <div className="emotion-layout">
                        <EmotionCircle
                            points={tracks}
                            highlighted={searchedTrack}
                            selectedPoint={selectedPoint}
                            hoveredPoint={hoveredPoint}
                            onSelectPoint={setSelectedPoint}
                            onHoverPoint={setHoveredPoint}
                        />

                        <div className="emotion-side">
                            <div className="emotion-card">
                                <div className="emotion-card-header simple">
                                    <div>
                                        <p className="emotion-card-subtitle">검색곡 감정 분석</p>
                                        <h3 className="emotion-card-title">{searchedTrack?.title}</h3>
                                    </div>
                                </div>

                                <div className="emotion-info-grid">
                                    <div className="emotion-info-item">
                                        <span>아티스트</span>
                                        <strong>{searchedTrack?.artist}</strong>
                                    </div>
                                    <div className="emotion-info-item">
                                        <span>감정 권역</span>
                                        <strong>{distributionInfo.zone}</strong>
                                    </div>
                                    <div className="emotion-info-item">
                                        <span>감정 해석</span>
                                        <strong>{distributionInfo.emotion}</strong>
                                    </div>
                                    <div className="emotion-info-item">
                                        <span>같은 권역 곡 수</span>
                                        <strong>{distributionInfo.sameQuadrant}곡</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="emotion-card">
                                <div className="emotion-card-header simple">
                                    <div>
                                        <p className="emotion-card-subtitle">가까운 분포의 곡</p>
                                        <h3 className="emotion-card-title">유사 위치 곡 목록</h3>
                                    </div>
                                </div>

                                <div className="emotion-track-list">
                                    {nearestTracks.map((track, index) => (
                                        <button
                                            key={`${track.id}-${index}`}
                                            ref={(el) => {
                                                if (el) trackItemRefs.current[track.id] = el;
                                            }}
                                            className={`emotion-track-item ${
                                                selectedPoint?.id === track.id ? "active" : ""
                                            }`}
                                            onClick={() => setSelectedPoint(track)}
                                            onMouseEnter={() => setHoveredPoint(track)}
                                            onMouseLeave={() => setHoveredPoint(null)}
                                        >
                                            <div>
                                                <strong>
                                                    {index + 1}. {track.title}
                                                </strong>
                                                <p>{track.artist}</p>
                                            </div>
                                            <span>{track.mood}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {selectedPoint && (
                                <div className="emotion-card">
                                    <div className="emotion-card-header simple">
                                        <div>
                                            <p className="emotion-card-subtitle">선택한 곡 정보</p>
                                            <h3 className="emotion-card-title">{selectedPoint.title}</h3>
                                        </div>
                                    </div>

                                    <div className="emotion-info-grid">
                                        <div className="emotion-info-item">
                                            <span>아티스트</span>
                                            <strong>{selectedPoint.artist}</strong>
                                        </div>
                                        <div className="emotion-info-item">
                                            <span>좌표</span>
                                            <strong>
                                                ({selectedPoint.x}, {selectedPoint.y})
                                            </strong>
                                        </div>
                                        <div className="emotion-info-item full">
                                            <span>감정 해석</span>
                                            <strong>{moodSummary(selectedPoint.x, selectedPoint.y)}</strong>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}