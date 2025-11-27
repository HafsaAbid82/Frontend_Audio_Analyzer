import { useState, useCallback, useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import './App.css';
const Plot = ({ data, layout }) => {
  const divRef = useRef(null);
  useEffect(() => {
    if (divRef.current) {
      Plotly.newPlot(divRef.current, data, layout, { responsive: true });
    }
    return () => {
      if (divRef.current) {
        Plotly.purge(divRef.current);
      }
    };
  }, [data, layout]);
  return <div ref={divRef} style={{ width: '100%', height: '100%' }} />;
};
const SPEAKER_STYLES = {
    'Speaker_0': { color: '#007bff', background: '#e6f0ff' }, 
    'Speaker_1': { color: '#28a745', background: '#e9f8ec' },
    'Speaker_2': { color: '#dc3545', background: '#fceaea' }, 
    'Speaker_3': { color: '#ffc107', background: '#fff9e6' },
    'Speaker_4': { color: '#6f42c1', background: '#f3ebfa' }, 
    'DEFAULT':   { color: '#6c757d', background: '#f8f9fa' }, 
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
  rttmFilename: '',
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
  const [rttmFile, setRttmFile] = useState(null);
  const uniqueSpeakers = analysisData.timelineData
    .map(item => item.speaker)
    .filter((value, index, self) => value && self.indexOf(value) === index)
    .sort();
  const getSpeakerStyle = (speakerId) => {
    return SPEAKER_STYLES[speakerId] || SPEAKER_STYLES['DEFAULT'];
  };
  const handleFileChange = (setter) => (event) => {
    const selectedFile = event.target.files[0];
    setter(selectedFile || null);
    if (selectedFile) {
      setStatusMessage(`File selected: ${selectedFile.name}`);
      setStatusType('neutral');
      setAnalysisData(initialAnalysisData);
    } 
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
      if (rttmFile) {
          formData.append('rttm_file', rttmFile);
      }
      const response = await fetch('https://hafsaabd82-audio-analyzer.hf.space/upload', {
          method: 'POST',
          body: formData,
      });
      const result = await response.json();
      if (response.ok) {
          setAnalysisData({
              isAnalyzed: true,
              filename: audioFile.name,
              rttmFilename: rttmFile ? rttmFile.name : 'N/A',
              duration: result.duration || 0,
              language: result.language || 'Unknown',
              der: result.der !== undefined ? result.der : null,
              speakerError: result.speaker_error !== null ? result.speaker_error : null,
              missedSpeech: result.missed_speech !== null ? result.missed_speech : null,
              falseAlarm: result.false_alarm !== null ? result.false_alarm : null,
              timelineData: result.timeline_data || [],
          });
          setStatusMessage('Analysis complete.');
          setStatusType('success');
      } else {
          setStatusMessage(result.detail || 'File upload and analysis failed.');
          setStatusType('error');
      }
    } catch (error) {
        console.error('Fetch error:', error);
        setStatusMessage(`Connection Error ${error.message}`);
        setStatusType('error');
    } finally {
        setLoading(false);
    }
  }, [audioFile, rttmFile]);
  const derMetricsAvailable = analysisData.der !== null;
  const derMetrics = derMetricsAvailable ? [
    analysisData.der,
    analysisData.speakerError,
    analysisData.missedSpeech,
    analysisData.falseAlarm
] : [0, 0, 0, 0];
  const plotData = [
    {
      x: ['DER', 'Speaker Error', 'Missed Speech', 'False Alarm'],
      y: derMetrics,
      type: 'bar',
      marker: { 
        color: derMetricsAvailable ? ['#dc3545', '#ffc107', '#20c997', '#007bff'] : ['#475569', '#475569', '#475569', '#475569'] 
      },
      name: derMetricsAvailable ? 'Error Rate' : 'No RTTM Provided',
    },
  ];
 const renderTimeline = () => {
    if (analysisData.timelineData.length === 0) {
        return <p>Transcription data will appear here after successful analysis.</p>;
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
            Speech and Speaker Analysis
          </h1>
          <p>
            Transcribe audio, perform speaker diarization, and calculate Diarization Error Rate (DER).
          </p>
        </header>
        <div className="section-box">
          <h2 className="section-title">1. Input Audio & Reference Files</h2>
          <form onSubmit={onSubmit}>
            <div className="flex-container">
                {renderFileInput(
                    'audio_file',
                    'Upload Audio File (MP3, WAV, etc.)',
                    audioFile,
                    setAudioFile,
                    'audio/*',
                )}
                {renderFileInput(
                    'rttm_file',
                    'Upload RTTM Reference File for DER',
                    rttmFile,
                    setRttmFile,
                    '.rttm',
                )}
            </div>
            <button
              type="submit"
              className="button button-primary"
              disabled={loading || !audioFile}
            >
              {loading && <div className="spinner"></div>}
              {loading ? 'Awaiting FastAPI...' : 'Run Analysis'}
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
        <div className="grid-layout">
          <div>
            <div className="section-box">
                <h2 className="section-title">
                    2.Transcription
                </h2>
                <div>
                    {analysisData.isAnalyzed && uniqueSpeakers.length > 0 && (
                        <div>
                            <span>Speakers Detected:</span>
                            {uniqueSpeakers.map(speaker => {
                                const style = getSpeakerStyle(speaker);
                                return (
                                    <span key={speaker}>
                                        {speaker}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div>
                    {renderTimeline()}
                </div>
            </div>
            <div className="section-box">
                <h2 className="section-title">
                    3. Diarization Error Rate
                </h2>
                <div>
                    <Plot
                        data={plotData}
                        layout={{
                            title: analysisData.isAnalyzed && derMetricsAvailable ? `Diarization Metrics for ${analysisData.filename}` : 'Upload Audio and RTTM to View Metrics',
                            font: { family: 'Arial', color: '#343a40' },
                            yaxis: { title: 'Error Percentage (0.0 - 1.0)', range: [0, 1] },
                            height: 400,
                            margin: { t: 50, r: 10, b: 50, l: 50 },
                            responsive: true,
                        }}
                    />
                </div>
            </div>
          <div className="section-box">
            <h2 className="section-title">
                4. Analysis Summary
            </h2>
            {analysisData.isAnalyzed ? (
              <div>
                <div>
                  <h3>File Information</h3>
                  <p>Audio: <span>{analysisData.filename}</span></p>
                  <p>RTTM Ref: <span>{analysisData.rttmFilename}</span></p>
                  <p>Duration: <span>{analysisData.duration ? `${analysisData.duration.toFixed(2)}s` : 'N/A'}</span></p>
                  <p>Language: <span>{analysisData.language || 'N/A'}</span></p>
                </div>
               {derMetricsAvailable ? (
                    <>
                        <p>
                            Overall DER: {(analysisData.der * 100).toFixed(2)}%
                        </p>
                         <h3>DER Components</h3>
                        <div>
                            <p>Speaker Error: <span>{analysisData.speakerError !== null ? (analysisData.speakerError * 100).toFixed(2) : 'N/A'}%</span></p>
                            <p>Missed Speech: <span>{analysisData.missedSpeech !== null ? (analysisData.missedSpeech * 100).toFixed(2) : 'N/A'}%</span></p>
                            <p>False Alarm: <span>{analysisData.falseAlarm !== null ? (analysisData.falseAlarm * 100).toFixed(2) : 'N/A'}%</span></p>
                        </div>
                    </>
                ) : (
                    <p>
                        RTTM file not provided. DER calculation skipped by the server.
                    </p>
                )}
              </div>
            ) : (
              <p>
                Waiting for the analysis results from the FastAPI backend.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default App;
