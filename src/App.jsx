import { useState, useCallback } from 'react';
const SPEAKER_STYLES = {
    'Speaker_0': { color: '#007bff', background: '#e6f0ff' },
    'Speaker_1': { color: '#28a745', background: '#e9f8ec' },
    'Speaker_2': { color: '#dc3545', background: '#fceaea' },
    'Speaker_3': { color: '#ffc107', background: '#fff9e6' },
    'Speaker_4': { color: '#6f42c1', background: '#f3ebfa' },
    'DEFAULT': { color: '#6c757d', background: '#f8f9fa' },
};
const renderFileInput = (id, label, fileState, setter, accept) => (
    <div className="file-upload-box">
        <label htmlFor={id} className="file-upload-label">
            {label}
        </label>
        <input
            id={id}
            type="file"
            accept={accept}
            onChange={(e) => setter(e.target.files[0] || null)}
            className="file-input"
        />
        {fileState && (
            <p className="file-selected">
                Selected: {fileState.name}
            </p>
        )}
    </div>
);
const initialAnalysisData = {
    isAnalyzed: false,
    filename: '',
    duration: 0,
    language: '',
    der: null, 
    speakerError: null,
    missedSpeech: null,
    falseAlarm: null,
    timelineData: [], 
};
const App = () => {
    const [statusMessage, setStatusMessage] = useState('');
    const [statusType, setStatusType] = useState(null);
    const [loading, setLoading] = useState(false);
    const [analysisData, setAnalysisData] = useState(initialAnalysisData);
    const [audioFile, setAudioFile] = useState(null);
    const uniqueSpeakers = analysisData.timelineData
        .map(item => item.speaker)
        .filter((value, index, self) => value && self.indexOf(value) === index)
        .sort();
    const getSpeakerStyle = (speakerId) => {
        return SPEAKER_STYLES[speakerId] || SPEAKER_STYLES['DEFAULT'];
    };
    const onSubmit = useCallback(async (event) => {
        event.preventDefault();
        if (!audioFile) {
            setStatusMessage('Select an audio file first.');
            setStatusType('error');
            return;
        }
        setLoading(true);
        setStatusMessage(`Uploading ${audioFile.name} and awaiting API response...`);
        setStatusType(null);
        setAnalysisData(initialAnalysisData);
        try {
            const formData = new FormData();
            formData.append('audio_file', audioFile);
            const response = await fetch('https://hafsaabd82-audio-analyzer.hf.space/upload', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (response.ok) {
                setAnalysisData({
                    isAnalyzed: true,
                    filename: audioFile.name,
                    duration: result.duration || 0,
                    language: result.language || 'Unknown',
                    // DER metrics are still stored but not displayed
                    der: result.der !== undefined ? result.der : null,
                    speakerError: result.speaker_error !== null ? result.speaker_error : null,
                    missedSpeech: result.missed_speech !== null ? result.missed_speech : null,
                    falseAlarm: result.false_alarm !== null ? result.false_alarm : null,
                    timelineData: result.timeline_data || [],
                });
                setStatusMessage('Analysis complete. Transcription results are displayed below.');
                setStatusType('success');
            } else {
                setStatusMessage(result.detail || 'File upload and analysis failed.');
                setStatusType('error');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            setStatusMessage(`Connection Error: ${error.message}. Check if the backend is running.`);
            setStatusType('error');
        } finally {
            setLoading(false);
        }
    }, [audioFile]); 
    const renderTimeline = () => {
        if (!analysisData.isAnalyzed) {
            return <p className="text-gray-500 italic">Upload an audio file and run the analysis to view the diarized transcription.</p>;
        }

        if (analysisData.timelineData.length === 0) {
            return <p className="text-gray-500 italic">No speech segments were detected in the audio.</p>;
        }
        const segments = [];
        let currentSegment = null;
        analysisData.timelineData.forEach((word) => {
            const { text, speaker, start, end } = word;
            if (currentSegment === null || speaker !== currentSegment.speaker) {
                if (currentSegment !== null) {
                    segments.push(currentSegment);
                }
                currentSegment = {
                    speaker: speaker,
                    words: [],
                    startTime: start,
                    endTime: end,
                };
            }
            currentSegment.words.push(text);
            currentSegment.endTime = end; 
        });
        if (currentSegment !== null) {
            segments.push(currentSegment);
        }
        return segments.map((segment, segIndex) => {
            const style = getSpeakerStyle(segment.speaker);
            const segmentText = segment.words.join(' ');
            return (
                <div
                    key={`segment-${segIndex}`}
                    className="transcription-segment"
                    style={{
                        backgroundColor: style.background,
                        borderLeft: `5px solid ${style.color}`,
                    }}
                >
                    <p className="speaker-label" style={{ color: style.color }}>
                        {segment.speaker || 'Unknown Speaker'}
                        <span className="timestamp">
                            ({segment.startTime.toFixed(2)}s - {segment.endTime.toFixed(2)}s)
                        </span>
                    </p>
                    <p className="segment-text">{segmentText}</p>
                </div>
            );
        });
    };
    return (
        <div className="container">
            <header className="header">
                <h1 className="title">
                    Speech and Speaker Diarization
                </h1>
                <p>
                    Upload audio to perform transcription and speaker identification.
                </p>
            </header>
            <div className="section-box">
                <h2 className="section-title">1. Upload Audio File</h2>
                <form onSubmit={onSubmit}>
                    <div className="flex-container justify-center">
                        {renderFileInput(
                            'audio_file',
                            'Select Audio File (MP3, WAV, etc.)',
                            audioFile,
                            setAudioFile,
                            'audio/*',
                        )}
                    </div>
                    <button
                        type="submit"
                        className="button button-primary"
                        disabled={loading || !audioFile}
                    >
                        {loading && <div className="spinner"></div>}
                        {loading ? 'Processing...' : 'Run Analysis'}
                    </button>
                </form>
                {statusMessage && (
                    <div className={`status-message ${
                        statusType === 'success'
                            ? 'status-success'
                            : statusType === 'error'
                                ? 'status-error'
                                : 'status-neutral'
                    }`}>
                        <span>
                            {statusType === 'success'
                                ? ' SUCCESS:'
                                : statusType === 'error'
                                    ? ' ERROR:'
                                    : ' INFO:'} {statusMessage}
                        </span>
                    </div>
                )}
            </div>
            <div className="section-box mt-8">
                <h2 className="section-title">
                    2. Diarized Transcription
                    {analysisData.isAnalyzed && analysisData.filename && (
                        <span className="text-sm font-normal text-gray-500 ml-3">
                            (File: {analysisData.filename} - Lang: {analysisData.language})
                        </span>
                    )}
                </h2>
                <div className="mb-4">
                    {analysisData.isAnalyzed && uniqueSpeakers.length > 0 && (
                        <div className="flex flex-wrap gap-2 text-sm text-gray-700">
                            <span className="font-semibold">Speakers Detected:</span>
                            {uniqueSpeakers.map(speaker => {
                                const style = getSpeakerStyle(speaker);
                                return (
                                    <span key={speaker} className="px-2 py-0.5 rounded-full text-xs font-medium"
                                          style={{ backgroundColor: style.background, color: style.color, border: `1px solid ${style.color}` }}>
                                        {speaker}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="transcription-output-container">
                    {renderTimeline()}
                </div>
            </div>

        </div>
    );
};
export default App;
