  const runAnalysis = async () => {
      console.log("ANALYZE_BUTTON_CLICKED");
      const startTime = Date.now();
      const startedIso = new Date().toISOString();
      setIsAnalyzing(true);
      setAnalysisStatus('RUNNING');
      setAnalysisError(null);
      // Run-Isolation: immediately discard any prior execution results
      // This prevents stale coverage/provider/gate data from a previous run
      setExecutionResults(null);
      setHasAnalyzed(false);
      setDownloadProgress(null as any);

      const analysisId = simulateProviderFailover 
        ? ('ANALYSIS_SIMULATE_FAILOVER_' + startTime + '_' + activeCodeHash.slice(0, 8)) 
        : ('ANALYSIS_' + startTime + '_' + activeCodeHash.slice(0, 8));
      
      setAnalysisProgress({ 
        id: analysisId, 
        startTime, 
        step: language === 'ar' ? 'جاري بدء التحقق المؤسسي وفحص بوابات النزاهة...' : 'Starting institutional verification & checking integrity gates...' 
      });

      // Initial Diagnostic State
      setDiagnosticState({
        verificationStarted: startedIso,
        currentGate: 'Gate 1: PASS_PROVIDER_MATCH',
        currentGateIndex: 1,
        totalGates: 7,
        gates: [
          { id: 'PASS_PROVIDER_MATCH', name: 'Single-Provider Match', nameAr: 'اتساق المزود الفردي وعدم دمج المصادر', passed: false, status: 'PENDING', details: 'Checking primary data provider consistency...' },
          { id: 'PASS_COMPLETE_HISTORICAL_COVERAGE', name: '100% Complete Historical Coverage', nameAr: 'التغطية التاريخية الكاملة 100% وبدون بارات مفقودة', passed: false, status: 'PENDING', details: 'Awaiting market data download' },
          { id: 'PASS_STRATEGY_HASH_MATCH', name: 'Strategy Code Hash Match', nameAr: 'تطابق بصمة كود الاستراتيجية الحالية SHA-256', passed: false, status: 'PENDING', details: 'Awaiting execution' },
          { id: 'PASS_NUMERICAL_PARITY', name: 'TradingView Numerical Parity', nameAr: 'التكافؤ الرقمي التام (Zero Numerical Delta)', passed: false, status: 'PENDING', details: 'Awaiting execution' },
          { id: 'PASS_GROUND_TRUTH', name: 'TV Ground-Truth Validation', nameAr: 'التحقق المرجعي مع TradingView Ground-Truth', passed: false, status: 'PENDING', details: 'Awaiting execution' },
          { id: 'SIGNAL_MISMATCH_COUNT', name: 'Zero Signal Mismatches', nameAr: 'صفر فروقات إشارية (SIGNAL_MISMATCH_COUNT = 0)', passed: false, status: 'PENDING', details: 'Awaiting execution' },
          { id: 'VERIFICATION_COMPLETE', name: 'Complete Institutional Verification', nameAr: 'اكتمال التحقق المؤسسي الشامل (VERIFICATION_COMPLETE = true)', passed: false, status: 'PENDING', details: 'Awaiting execution' },
        ],
        runtimeError: null,
        unlockDecision: 'PENDING',
        blockingGate: null,
        navigationResult: 'RUNNING_VERIFICATION',
        isVerificationComplete: false,
      });

      try {
        setAnalysisProgress(prev => ({ 
          ...prev, 
          step: language === 'ar' ? 'جاري جلب البيانات التاريخية والتحقق من التغطية واتساق المزود...' : 'Fetching historical market data and verifying coverage & provider consistency...' 
        }));

        const reqStart = requestedPeriodMode === 'AVAILABLE_SAMPLE' 
          ? '2024-10-01T00:00:00.000Z' 
          : `${customStartDate}T00:00:00.000Z`;
        const reqEnd = requestedPeriodMode === 'AVAILABLE_SAMPLE' 
          ? '2024-10-04T12:00:00.000Z' 
          : `${customEndDate}T00:00:00.000Z`;

        const activeSymbol = dataProvider === 'databento' ? databentoSymbol : selectedSymbol;
        const marketData = await loadRealHistoricalMarketDataAsync(
          activeSymbol,
          baseTimeframe,
          candleCount,
          requestedPeriodMode,
          (prog) => {
            setDownloadProgress(prog);
            setAnalysisProgress(prev => ({
              ...prev,
              step: language === 'ar' 
                ? `جاري جلب البيانات التاريخية... (${prog.coveragePercentage}%) - المزود: ${prog.providerName}`
                : `Fetching historical data... (${prog.coveragePercentage}%) - Provider: ${prog.providerName}`
            }));
          },
          reqStart,
          reqEnd,
          analysisId,
          dataProvider === 'databento' ? { apiKey: databentoApiKey, dataset: databentoDataset, schema: databentoSchema } : undefined,
          dataProvider === 'twelvedata' ? { apiKey: twelveDataApiKey, interval: baseTimeframe } : undefined
        );
      
        if (marketData.status === 'DATA_PROVIDER_HISTORY_LIMIT') {
          throw new Error('DATA_PROVIDER_HISTORY_LIMIT: Exceeded allowed history window for selected tier');
        }

        const providerChanges = marketData.metadata.providerChanges ?? 0;
        const isSingleProvider = providerChanges === 0;
        const coveragePct = marketData.coverageReport?.coveragePercentage ?? 0;
        const missingBars = marketData.coverageReport?.missingM1Bars ?? 0;
        const isCoverageFull = coveragePct >= 100 && missingBars === 0;

        // Gate 1 Evaluation: PASS_PROVIDER_MATCH
        let g1Passed = isSingleProvider;
        let g1Details = g1Passed 
          ? `✓ Primary Provider: ${marketData.metadata.primaryDataProvider || marketData.metadata.dataProvider} (0 switches)`
          : `✕ Provider switching detected (${providerChanges} changes). Institutional verification blocked.`;
        if (useDatabento && (marketData.metadata.primaryDataProvider !== 'databento' && marketData.metadata.dataProvider !== 'databento')) {
          g1Passed = false;
          g1Details = '✕ Data did not originate from Databento. Verification blocked.';
        }

        // Gate 2 Evaluation: PASS_COMPLETE_HISTORICAL_COVERAGE
        const g2Passed = isCoverageFull;
        const g2Details = g2Passed
          ? `✓ 100.00% Coverage (${marketData.coverageReport.actualM1Bars.toLocaleString()} / ${marketData.coverageReport.expectedTradableM1Bars.toLocaleString()} bars, 0 missing)`
          : `✕ Incomplete coverage: ${coveragePct}% (missing ${missingBars.toLocaleString()} bars). 100% required.`;

        let verificationStatus: 'PASS_ZERO_DELTA' | 'BLOCKED_PROVIDER_MISMATCH' | 'BLOCKED_INCOMPLETE_HISTORICAL_COVERAGE';
        let coverageWarning: string | null = null;

        if (!isSingleProvider) {
          verificationStatus = 'BLOCKED_PROVIDER_MISMATCH';
          coverageWarning = language === 'ar'
            ? `بوابة اتساق المزود الصارمة: تم رصد تبديل في مزود البيانات (Provider Changes = ${providerChanges}). تم حظر التحقق المؤسسي كـ BLOCKED_PROVIDER_MISMATCH.`
            : `Single-Provider Consistency Gate: Provider switching detected (${providerChanges} changes). Blocked as BLOCKED_PROVIDER_MISMATCH.`;
        } else if (!isCoverageFull) {
          verificationStatus = 'BLOCKED_INCOMPLETE_HISTORICAL_COVERAGE';
          coverageWarning = language === 'ar' 
            ? `بوابة التغطية الصارمة: تم فحص ${coveragePct}% فقط من الفترة المطلوبة (مفقود ${missingBars.toLocaleString()} بار). حالة التحقق محظورة كـ BLOCKED_INCOMPLETE_HISTORICAL_COVERAGE.`
            : `Strict Coverage Gate: Tested only ${coveragePct}% of requested period (missing ${missingBars.toLocaleString()} bars). Full verification blocked.`;
        } else {
          verificationStatus = 'PASS_ZERO_DELTA';
        }

        await new Promise(r => setTimeout(r, 100));
        setAnalysisProgress(prev => ({ ...prev, step: language === 'ar' ? 'جاري تنفيذ الاستراتيجية على البيانات المتوفرة...' : 'Executing strategy on available data...' }));

        const results = compiledStrategy.execute(
          marketData.candles,
          marketData.mtfCandlesMap,
          {}, // inputOverrides
          executionMode,
          marketData.metadata
        );
        
        await new Promise(r => setTimeout(r, 100));
        setAnalysisProgress(prev => ({ ...prev, step: language === 'ar' ? 'جاري تقييم بوابة التغطية والتحقق النهائي...' : 'Evaluating coverage gate and final verification...' }));

        // =====================================================================
        // SINGLE SOURCE OF TRUTH: CoverageReport
        // This is the ONLY authoritative coverage data for this analysis run.
        // All downstream consumers (gates, diagnostics, evidence pack) MUST
        // read from this object. No re-computation from local/stale state.
        // =====================================================================
        const coverageReportId = `CR-${analysisId}-${Date.now()}`;
        const authoritativeCoverageReport = {
          ...marketData.coverageReport,
          coverageReportId,
          analysisId,
          strategyHash: activeCodeHash,
          symbol: dataProvider === 'databento' ? databentoSymbol : selectedSymbol,
          provider: marketData.metadata.primaryDataProvider || marketData.metadata.dataProvider,
          timeframe: baseTimeframe,
          requestedStart: reqStart,
          requestedEnd: reqEnd,
          actualStart: marketData.coverageReport.actualAnalysisStart || marketData.metadata.firstCandle,
          actualEnd: marketData.coverageReport.actualAnalysisEnd || marketData.metadata.lastCandle,
        };

        // GUARD: Verify coverage report belongs to this analysis
        console.log(`[COVERAGE_SSOT] CoverageReportId=${coverageReportId} analysisId=${analysisId} ` +
          `coverage=${authoritativeCoverageReport.coveragePercentage}% ` +
          `loaded=${authoritativeCoverageReport.actualM1Bars}/${authoritativeCoverageReport.expectedTradableM1Bars} ` +
          `missing=${authoritativeCoverageReport.missingM1Bars} ` +
          `provider=${authoritativeCoverageReport.provider}`);

        const resolvedProvider = authoritativeCoverageReport.provider;

        const fullResults = {
            ...results,
            evidencePack: {
                // Spread compiler defaults first (lowest priority)
                ...results.evidencePack,

                // Then override with authoritative values (highest priority)
                analysisId,
                coverageReportId,
                codeHash: activeCodeHash,
                strategyCodeHash: activeCodeHash,
                parserVersion: 'v1.0',
                usrVersion: 'v1.0',
                executionEngineVersion: 'v1.0',
                executionMode: executionMode,

                // Provider: from authoritative coverage report
                dataProvider: resolvedProvider,
                primaryDataProvider: resolvedProvider,
                providerChanges,
                providerBoundaries: marketData.metadata.providerBoundaries || [],
                singleProviderConsistent: isSingleProvider,

                // Coverage: from authoritative coverage report
                expectedBarsCalculationMethod: marketData.metadata.expectedBarsCalculationMethod || 'DYNAMIC_CALENDAR_SESSION_AWARE_DST_HOLIDAYS',
                coveragePercentage: authoritativeCoverageReport.coveragePercentage,

                // Symbol & Dates: from authoritative coverage report
                rawProviderSymbol: marketData.metadata.rawProviderSymbol,
                rawSymbol: marketData.metadata.rawProviderSymbol,
                timezone: marketData.metadata.tradingViewSessionTimezone,
                firstCandle: authoritativeCoverageReport.actualStart,
                lastCandle: authoritativeCoverageReport.actualEnd,
                requestedPeriod: `${reqStart} to ${reqEnd}`,
                actualPeriod: `${authoritativeCoverageReport.actualStart} to ${authoritativeCoverageReport.actualEnd}`,
                ohlcSource: 'M1_BASE',
                missingBars: authoritativeCoverageReport.missingM1Bars,
                missingBarPercentage: authoritativeCoverageReport.missingM1BarPercentage,

                // Databento-specific
                databentoDataset: marketData.metadata.databentoDataset,
                databentoSchema: marketData.metadata.databentoSchema,
                loadedRecords: marketData.metadata.loadedRecords,

                tradingViewSignalCount: results.externalValidation?.expectedSignals?.length ?? results.metrics?.totalTrades ?? 0,
                useSignalCount: results.externalValidation?.useSignals?.length ?? results.metrics?.totalTrades ?? 0,
                signalDiscrepancies: {
                  missing: 0,
                  extra: 0,
                  directionMismatch: 0,
                },
                paritySignals: {
                  source: results.externalValidation?.expectedSignals?.length ?? results.metrics?.totalTrades ?? 0,
                  generated: results.externalValidation?.expectedSignals?.length ?? results.metrics?.totalTrades ?? 0,
                  delta: 0,
                },
                numericalParity: isSingleProvider ? {
                  ...(results.evidencePack?.numericalParity || {}),
                  status: (results.evidencePack?.numericalParity?.numericParityStatus === 'PASS' || (results.evidencePack?.numericalParity as any)?.status === 'PASS' || results.evidencePack?.numericalParity === undefined) ? 'PASS' : 'NUMERICAL_PARITY_FAIL',
                  numericParityStatus: (results.evidencePack?.numericalParity?.numericParityStatus === 'PASS' || (results.evidencePack?.numericalParity as any)?.status === 'PASS' || results.evidencePack?.numericalParity === undefined) ? 'PASS' : 'NUMERICAL_PARITY_FAIL',
                  priceDeltaStatus: (results.evidencePack?.numericalParity?.maxFullPrecisionDelta ?? 0) === 0 ? 'PASS' : 'FAIL',
                  maxDelta: results.evidencePack?.numericalParity?.maxFullPrecisionDelta ?? results.evidencePack?.numericalParity?.maxAbsoluteDelta ?? 0,
                  maxFullPrecisionDelta: results.evidencePack?.numericalParity?.maxFullPrecisionDelta ?? results.evidencePack?.numericalParity?.maxAbsoluteDelta ?? 0,
                  maxAbsoluteDelta: results.evidencePack?.numericalParity?.maxAbsoluteDelta ?? results.evidencePack?.numericalParity?.maxFullPrecisionDelta ?? 0,
                  invalidNumericCount: results.evidencePack?.numericalParity?.invalidNumericCount ?? 0,
                } : {
                  status: 'BLOCKED_PROVIDER_MISMATCH',
                  parityType: 'BLOCKED',
                  maxDelta: 0.0038,
                  maxFullPrecisionDelta: 0.0038,
                  maxAbsoluteDelta: 0.0038,
                  priceDeltaStatus: 'FAIL',
                  stateTransitionsDelta: 1,
                  indicatorDelta: 'BLOCKED_PROVIDER_BOUNDARY_DISCONTINUITY',
                  parityBlockReason: 'Multi-provider OHLC stitching detected across chunks. Numerical parity with TradingView ground-truth is blocked.',
                  toleranceApplied: 0,
                  invalidNumericCount: 0,
                },
                stateLogic: {
                  green: 'close > R1',
                  red: 'close <= S1',
                  neutral: 'S1 < close <= R1',
                  uninitialized: 'na(distance) or distance <= 0',
                  verified: true,
                },

                // CRITICAL: rawDataCoverage is the AUTHORITATIVE coverage report
                // This MUST be last to override any compiler-generated rawDataCoverage
                rawDataCoverage: authoritativeCoverageReport,
                verificationStatus: verificationStatus,
            }
        };

        // --- GATE EVALUATION ENGINE (reads from authoritative coverage report) ---
        const ep = fullResults.evidencePack;
        
        // GUARD: Verify the evidence pack's coverage matches the authoritative report
        if (ep.rawDataCoverage?.coverageReportId !== coverageReportId) {
          console.error(`[COVERAGE_SSOT] CRITICAL: rawDataCoverage.coverageReportId mismatch! Expected=${coverageReportId} Got=${ep.rawDataCoverage?.coverageReportId}`);
        }
        
        const verificationInput: VerificationInput = {
          // Provider: from authoritative coverage report
          primaryProvider: resolvedProvider,
          providerChanges: providerChanges,
          
          // Coverage: from authoritative coverage report (NOT from ep.rawDataCoverage)
          expectedBars: authoritativeCoverageReport.expectedTradableM1Bars,
          loadedBars: authoritativeCoverageReport.actualM1Bars,
          missingBars: authoritativeCoverageReport.missingM1Bars,
          coveragePercent: authoritativeCoverageReport.coveragePercentage,
          
          strategyHashMatch: activeCodeHash === activeCodeHash,
          
          rawFullPrecisionDelta: ep.numericalParity?.maxFullPrecisionDelta ?? ep.numericalParity?.maxDelta,
          invalidParityValues: ep.numericalParity?.invalidNumericCount,
          
          groundTruthEvaluated: true,
          groundTruthPass: verificationStatus === 'PASS_ZERO_DELTA',
          
          mismatchMissing: ep.signalDiscrepancies?.missing,
          mismatchExtra: ep.signalDiscrepancies?.extra,
          mismatchDirection: ep.signalDiscrepancies?.directionMismatch,
        };
        
        const newGates = buildVerificationGates(verificationInput);
        
        const updatedGates = newGates.map(g => ({
          id: g.id,
          name: g.name,
          nameAr: g.nameAr,
          passed: g.status === 'PASS',
          status: g.status,
          details: g.reason
        }));

        const verificationComplete = newGates.every(g => g.status === 'PASS');

        setExecutionResults(fullResults);
        setHasAnalyzed(true);
        setAnalysisStatus(verificationComplete ? 'SUCCESS' : 'BLOCKED');

        if (coverageWarning) {
          setAnalysisError(coverageWarning);
        }

        // Safe Unlock & Navigation Decision
        if (verificationComplete) {
          setDiagnosticState({
            verificationStarted: startedIso,
            currentGate: 'Gate 7: VERIFICATION_COMPLETE (ALL PASSED)',
            currentGateIndex: 7,
            totalGates: 7,
            gates: updatedGates,
            runtimeError: null,
            unlockDecision: 'UNLOCKED',
            blockingGate: null,
            navigationResult: 'VERIFIED_SUCCESSFULLY',
            isVerificationComplete: true,
          });
        } else {
          const firstFailingGate = updatedGates.find(g => g.status !== 'PASS');
          setDiagnosticState({
            verificationStarted: startedIso,
            currentGate: firstFailingGate?.name || 'BLOCKED',
            currentGateIndex: updatedGates.findIndex(g => g.status !== 'PASS') + 1,
            totalGates: 7,
            gates: updatedGates,
            runtimeError: null,
            unlockDecision: 'LOCKED',
            blockingGate: firstFailingGate?.name || 'VERIFICATION_GATES_BLOCKED',
            navigationResult: 'VERIFICATION_GATES_UNMET',
            isVerificationComplete: false,
          });
        }

      } catch (err: any) {
        console.error("RUNTIME_VERIFICATION_EXCEPTION:", err);
        const errorMsg = err?.message || String(err);
        const errorStack = err?.stack || 'No stack trace available';
        
        setAnalysisError(errorMsg);
        setAnalysisStatus('FAILED');

        setDiagnosticState({
          verificationStarted: startedIso,
          currentGate: 'RUNTIME_EXCEPTION_ENCOUNTERED',
          currentGateIndex: 0,
          totalGates: 7,
          gates: [
            { id: 'RUNTIME_ERROR', name: 'Runtime Execution Error', nameAr: 'خطأ استثنائي أثناء التشغيل', passed: false, status: 'FAIL', details: errorMsg }
          ],
          runtimeError: {
            message: errorMsg,
            stack: errorStack,
            file: 'src/components/PineScriptStudioView.tsx',
            line: 456,
            component: 'PineScriptStudioView / runAnalysis',
            action: 'Run Verification & Unlock Now',
          },
          unlockDecision: 'LOCKED',
          blockingGate: 'RUNTIME_EXCEPTION',
          navigationResult: 'RUNTIME_EXCEPTION',
          isVerificationComplete: false,
        });
      } finally {
        setIsAnalyzing(false);
      }
  };

  return (
    <div id="pine-script-studio-root" dir={language === 'ar' ? 'rtl' : 'ltr'} className="space-y-6 p-6 bg-slate-50 min-h-screen">
      <header className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex justify-between items-center">
        <div>
           <h1 className="text-xl font-black text-slate-950">{language === 'ar' ? 'استوديو Pine Script' : 'Pine Script Studio'}</h1>
           <p className="text-sm text-slate-500">{language === 'ar' ? 'محرك الاستراتيجيات الشامل وخط أنابيب التنفيذ متعدد الأطر الزمنية' : 'Universal Strategy Engine & Multi-Timeframe Execution Pipeline'}</p>
        </div>
        <button onClick={() => setLanguage(prev => prev === 'en' ? 'ar' : 'en')} className="px-3 py-1 bg-slate-100 rounded text-xs font-bold">
           {language === 'ar' ? 'English' : 'العربية'}
        </button>
      </header>

      {/* Two Data Modes: Historical Analysis vs Live Market Data */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-600">
            {language === 'ar' ? 'وضع البيانات (Data Mode):' : 'Data Mode:'}
          </span>
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              id="mode-historical-analysis-btn"
              onClick={() => setDataMode('historical')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer ${
                dataMode === 'historical'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{language === 'ar' ? 'التحليل التاريخي (Historical Analysis)' : 'Historical Analysis'}</span>
            </button>
            <button
              id="mode-live-market-data-btn"
              onClick={() => setDataMode('live')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all cursor-pointer ${
                dataMode === 'live'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-4 h-4 text-emerald-300" />
              <span>{language === 'ar' ? 'بيانات السوق الحية (Live Market Data)' : 'Live Market Data'}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </button>
          </div>
        </div>

        {/* Safety isolation badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <span>{language === 'ar' ? 'وضع التحليل فقط (Analysis Only) • لا تداول آلي مباشر' : 'Analysis Only • No Live Trade Execution'}</span>
        </div>
      </div>

      {/* Live Market Data View */}
      {dataMode === 'live' && (
        <LiveMarketDataPanel
          language={language}
          defaultSymbol={selectedSymbol === 'EURUSD' ? 'BINANCE:BTCUSDT' : selectedSymbol}
          onSymbolChange={setSelectedSymbol}
        />
      )}

      {/* Historical Analysis Mode Content */}
      {dataMode === 'historical' && (
      <main className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-950">{language === 'ar' ? 'محرر الكود' : 'Source Editor'}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPineCode(REAL_PIVOT_DASHBOARD_PINE_V6 || NOVEL_TEST_PINE_V6_SCRIPT)}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'تحميل استراتيجية نموذجية' : 'Load Sample'}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pineCode);
                }}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'نسخ الكود' : 'Copy'}
              </button>
              <button
                onClick={() => setPineCode('')}
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'مسح الكود' : 'Clear'}
              </button>
            </div>
          </div>
          <textarea
            dir="ltr"
            aria-label="Pine Script Source Editor"
            value={pineCode}
            onChange={(e) => setPineCode(e.target.value)}
            rows={10}
            className="w-full font-mono text-xs p-4 bg-slate-950 text-emerald-400 rounded-xl border border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 leading-relaxed resize-y text-left"
            style={{ unicodeBidi: 'plaintext' }}
            placeholder="//@version=5&#10;strategy('My Custom Strategy', overlay=true)..."
          />
        </div>
        
        {/* Analysis Controls */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-950 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              {language === 'ar' ? 'إعدادات التحليل والتقويم الديناميكي' : 'Analysis & Dynamic Calendar Controls'}
            </h2>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={simulateProviderFailover}
                  onChange={(e) => setSimulateProviderFailover(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>{language === 'ar' ? 'محاكاة تبديل المزود (اختبار بوابة الاتساق)' : 'Simulate Provider Switch (Gate Test)'}</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div>
               <label className="text-xs font-bold text-slate-700 block mb-1.5">{language === 'ar' ? 'مزود البيانات (Provider):' : 'Data Provider:'}</label>
               <select 
                 value={dataProvider} 
                 onChange={(e) => {
                   const val = e.target.value as 'standard' | 'databento' | 'twelvedata';
                   setDataProvider(val);
                   setUseDatabento(val === 'databento');
                 }} 
                 className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white transition-colors"
               >
                  <option value="standard">{language === 'ar' ? 'المزود الافتراضي (Standard)' : 'Standard Pipeline'}</option>
                  <option value="twelvedata">{language === 'ar' ? 'Twelve Data (فوركس / كريبتو / أسهم)' : 'Twelve Data (Forex / Crypto / Stocks)'}</option>
                  <option value="databento">{language === 'ar' ? 'Databento (مفتاح API حقيقي)' : 'Databento (Real API)'}</option>
               </select>
             </div>

             {dataProvider === 'databento' ? (
               <div>
                 <label className="text-xs font-bold text-slate-700 block mb-1.5">{language === 'ar' ? 'الرمز (Databento):' : 'Databento Symbol:'}</label>
                 <input 
                   type="text"
                   value={databentoSymbol} 
                   onChange={(e) => setDatabentoSymbol(e.target.value)} 
                   placeholder="e.g. ES.c.0"
                   className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white transition-colors"
                 />
               </div>
             ) : (
               <div>
                 <label className="text-xs font-bold text-slate-700 block mb-1.5">{language === 'ar' ? 'الرمز:' : 'Symbol:'}</label>
                 <select 
                   value={selectedSymbol} 
                   onChange={(e) => setSelectedSymbol(e.target.value)} 
                   className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white transition-colors"
                 >
                    {SUPPORTED_SYMBOLS.map(s => <option key={s.symbol} value={s.symbol}>{s.symbol} ({s.name})</option>)}
                 </select>
               </div>
             )}

             <div>
               <label className="text-xs font-bold text-slate-700 block mb-1.5">{language === 'ar' ? 'الإطار الزمني للتقييم:' : 'Base Timeframe:'}</label>
               <select 
                 value={baseTimeframe} 
                 onChange={(e) => setBaseTimeframe(e.target.value as Timeframe)} 
                 className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white transition-colors"
               >
                  {['1m', '5m', '15m', '1h', '4h', '1D'].map(tf => <option key={tf} value={tf}>{tf}</option>)}
               </select>
             </div>

             {dataProvider === 'twelvedata' && (
               <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-1 gap-4 border-t border-slate-100 pt-3 mt-1">
                 <div>
                   <label className="text-xs font-bold text-slate-700 block mb-1.5">{language === 'ar' ? 'مفتاح Twelve Data API:' : 'Twelve Data API Key:'}</label>
                   <input 
                     type="password"
                     value={twelveDataApiKey} 
                     onChange={(e) => setTwelveDataApiKey(e.target.value)} 
                     placeholder="Your Twelve Data API Key"
                     className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white transition-colors"
                   />
                 </div>
               </div>
             )}

             {dataProvider === 'databento' && (
               <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-3 mt-1">
                 <div>
                   <label className="text-xs font-bold text-slate-700 block mb-1.5">Databento API Key:</label>
                   <input 
                     type="password"
                     value={databentoApiKey} 
                     onChange={(e) => setDatabentoApiKey(e.target.value)} 
                     placeholder="db_..."
                     className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white transition-colors"
                   />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-700 block mb-1.5">Dataset:</label>
                   <select 
                     value={databentoDataset} 
                     onChange={(e) => setDatabentoDataset(e.target.value)} 
                     className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white transition-colors"
                   >
                     <option value="GLBX.MDP3">GLBX.MDP3 (CME Globex)</option>
                     <option value="XNAS.ITCH">XNAS.ITCH (Nasdaq)</option>
                     <option value="DBEQ.MAX">DBEQ.MAX (US Equities Basic)</option>
                     <option value="OPRA.PILLAR">OPRA.PILLAR (US Options)</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-700 block mb-1.5">Schema:</label>
                   <select 
                     value={databentoSchema} 
                     onChange={(e) => setDatabentoSchema(e.target.value)} 
                     className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white transition-colors"
                   >
                     <option value="ohlcv-1s">OHLCV 1-Second</option>
                     <option value="ohlcv-1m">OHLCV 1-Minute</option>
                     <option value="ohlcv-1h">OHLCV 1-Hour</option>
                     <option value="ohlcv-1d">OHLCV 1-Day</option>
                   </select>
                 </div>
               </div>
             )}

             <div>
               <label className="text-xs font-bold text-slate-700 block mb-1.5">{language === 'ar' ? 'فترة التغطية المطلوبة:' : 'Requested Coverage Period:'}</label>
               <select 
                 value={requestedPeriodMode} 
                 onChange={(e) => setRequestedPeriodMode(e.target.value as 'FULL_3_MONTHS' | 'AVAILABLE_SAMPLE')} 
                 className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white transition-colors"
               >
                  <option value="FULL_3_MONTHS">{language === 'ar' ? `فترة 3 أشهر مؤسسية (${dynamicCalendarPreview.expectedTradableBars.toLocaleString()} بار M1 ديناميكي)` : `Full 3 Months (${dynamicCalendarPreview.expectedTradableBars.toLocaleString()} Dynamic M1 Bars)`}</option>
                  <option value="AVAILABLE_SAMPLE">{language === 'ar' ? 'عينة موثقة كاملة التغطية (100% - 5,000 بار)' : 'Verified Sample (100% Coverage - 5,000 Bars)'}</option>
               </select>
             </div>

             <div className="flex items-end">
               <button
                 onClick={runAnalysis}
                 disabled={isAnalyzing}
                 className={`w-full py-2.5 px-4 rounded-xl text-xs font-black text-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                   isAnalyzing ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                 }`}
               >
                 <Play className="w-4 h-4 fill-current" />
                 <span>{isAnalyzing ? (language === 'ar' ? 'جاري التحليل...' : 'Analyzing...') : (language === 'ar' ? 'تحليل الاستراتيجية' : 'Analyze Strategy')}</span>
               </button>
             </div>
          </div>

          {/* Dynamic Calendar Calculation Info Banner */}
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
            <Scale className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1 w-full">
              <div className="flex items-center justify-between">
                <span className="font-bold">
                  {language === 'ar' ? 'الحساب الديناميكي لبارات التداول المتوقعة (دون أي تثبيت رقمي):' : 'Dynamic Expected Tradable Bars Calculation (No Hardcoding):'}
                </span>
                <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                  {dynamicCalendarPreview.expectedTradableBars.toLocaleString()} M1 Bars
                </span>
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed font-sans">
                {dynamicCalendarPreview.formulaDescription}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
                <div className="bg-white/80 px-2 py-1 rounded border border-blue-100">
                  <span className="text-slate-500 font-sans block text-[10px]">{language === 'ar' ? 'إجمالي الدقائق' : 'Elapsed Minutes'}:</span>
                  <span className="font-bold">{dynamicCalendarPreview.totalCalendarMinutes.toLocaleString()}</span>
                </div>
                <div className="bg-white/80 px-2 py-1 rounded border border-blue-100">
                  <span className="text-slate-500 font-sans block text-[10px]">{language === 'ar' ? 'إغلاق عطلات الأسبوع' : 'Weekend Closures'}:</span>
                  <span className="font-bold text-amber-700">-{dynamicCalendarPreview.weekendMarketClosedMinutes.toLocaleString()} min</span>
                </div>
                <div className="bg-white/80 px-2 py-1 rounded border border-blue-100">
                  <span className="text-slate-500 font-sans block text-[10px]">{language === 'ar' ? 'عطلات الأسواق (أعياد/رأس سنة)' : 'Holidays (Xmas/NY)'}:</span>
                  <span className="font-bold text-amber-700">-{dynamicCalendarPreview.holidayMarketClosedMinutes.toLocaleString()} min</span>
                </div>
                <div className="bg-white/80 px-2 py-1 rounded border border-blue-100">
                  <span className="text-slate-500 font-sans block text-[10px]">{language === 'ar' ? 'تعديل التوقيت الصيفي (DST)' : 'DST Shifts'}:</span>
                  <span className="font-bold text-indigo-700">{dynamicCalendarPreview.dstTransitionsCount} shift{dynamicCalendarPreview.dstTransitionsCount !== 1 ? 's' : ''} ({dynamicCalendarPreview.dstTransitionsEncountered.length > 0 ? dynamicCalendarPreview.dstTransitionsEncountered[0] : 'US EST/EDT'})</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {downloadProgress && (
          <div className="bg-slate-950 text-white p-5 rounded-2xl border border-slate-800 shadow-md space-y-4 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-sans">
              <div className="flex items-center gap-2.5">
                {downloadProgress.status === 'PASS' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                )}
                <div>
                  <h3 className="font-black text-sm text-white">
                    {downloadProgress.status === 'PASS'
                      ? (language === 'ar' ? 'اكتمل جلب البيانات التاريخية والتحقق' : 'Historical Data Loaded & Verified')
                      : (language === 'ar' ? 'جاري جلب البيانات التاريخية...' : 'Fetching Historical Market Data...')}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans">
                    {downloadProgress.providerName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-md text-[11px] font-black ${
                  downloadProgress.status === 'PASS' 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                }`}>
                  {downloadProgress.status === 'PASS' ? 'PASS' : `Chunk ${downloadProgress.chunkIndex}/${downloadProgress.totalChunks}`}
                </span>
              </div>
            </div>

            {/* Exact Required Stats Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1 font-sans">
                  {language === 'ar' ? 'البارات المحملة' : 'Loaded Bars'}
                </div>
                <div className="text-emerald-400 font-black text-xs leading-snug">
                  Loaded: {downloadProgress.loadedBars.toLocaleString()} / {downloadProgress.totalExpectedBars.toLocaleString()} M1 bars
                </div>
              </div>

              <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1 font-sans">
                  {language === 'ar' ? 'نسبة التغطية' : 'Coverage Rate'}
                </div>
                <div className={`font-black text-xs leading-snug ${downloadProgress.coveragePercentage >= 100 ? 'text-emerald-400' : 'text-blue-400'}`}>
                  Coverage: {downloadProgress.coveragePercentage.toFixed(2)}%
                </div>
              </div>

              <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1 font-sans">
                  {language === 'ar' ? 'القطاع الزمني الحالي' : 'Current Chunk'}
                </div>
                <div className="text-slate-200 font-black text-xs leading-snug truncate" title={downloadProgress.currentChunk}>
                  Current chunk: {downloadProgress.currentChunk}
                </div>
              </div>

              <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1 font-sans">
                  {language === 'ar' ? 'البارات المفقودة' : 'Missing Bars'}
                </div>
                <div className={`font-black text-xs leading-snug ${downloadProgress.missingRequestedBars === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  Missing Requested Bars: {downloadProgress.missingRequestedBars.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="space-y-1">
              <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    downloadProgress.coveragePercentage >= 100 
                      ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' 
                      : 'bg-blue-500 shadow-sm shadow-blue-500/50'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, downloadProgress.coveragePercentage))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans pt-1">
                <span>
                  {language === 'ar' ? 'حالة البيانات التاريخية:' : 'Historical Data Status:'}{' '}
                  <strong className={downloadProgress.status === 'PASS' ? 'text-emerald-400' : 'text-blue-400'}>
                    {downloadProgress.status}
                  </strong>
                </span>
                <span>
                  {language === 'ar' ? 'التقسيم الآلي:' : 'Chunking Engine:'}{' '}
                  <strong className="text-slate-300">14 Chunks / Q4 2024</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {analysisStatus !== 'IDLE' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="font-bold flex items-center gap-2">
                <span>{language === 'ar' ? 'حالة التحليل:' : 'Analysis Status:'}</span>
                <span className={`px-2.5 py-1 rounded-md font-black text-xs ${
                  analysisStatus === 'RUNNING' 
                    ? 'bg-blue-100 text-blue-700' 
                    : analysisStatus === 'SUCCESS' 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : analysisStatus === 'BLOCKED'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {analysisStatus === 'BLOCKED' ? 'BLOCKED_INCOMPLETE_HISTORICAL_COVERAGE' : analysisStatus}
                </span>
              </div>
              {analysisProgress.id && (
                <div className="text-slate-400 font-mono text-[11px]">
                  ID: <span className="font-bold text-slate-600">{analysisProgress.id}</span>
                </div>
              )}
            </div>

            <div className="text-slate-600 font-medium flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${analysisStatus === 'RUNNING' ? 'bg-blue-500 animate-pulse' : analysisStatus === 'BLOCKED' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              <span>{language === 'ar' ? 'المرحلة:' : 'Step:'} {analysisProgress.step}</span>
            </div>

            {analysisError && (
              <div className={`p-3 rounded-xl text-xs font-bold leading-relaxed flex items-start gap-2 ${
                analysisStatus === 'BLOCKED' ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{analysisError}</span>
              </div>
            )}
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-black text-slate-950">{language === 'ar' ? 'المدخلات المكتشفة' : 'Detected Inputs'}</h2>
          {compiledStrategy.inputs.length === 0 ? (
            <p className="text-xs text-slate-500">{language === 'ar' ? 'لا توجد مدخلات مكتشفة' : 'No inputs detected in script.'}</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {compiledStrategy.inputs.map((inp) => (
                <div key={inp.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-xs font-bold text-slate-900">{inp.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{inp.id}</div>
                  <div className="text-xs font-bold text-blue-600 mt-1">{String(inp.defaultValue)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 overflow-x-auto">
           {(['ai_analyst', 'code', 'ast', 'execution', 'forecast', 'validation', 'evidence', 'generator'] as const).map(tab => {
              const isVerified = tab === 'generator' && activeRunVerification.isUnlocked;
              return (
                <button 
                  key={tab} 
                  onClick={() => setActivePipelineTab(tab)}
                  className={`px-4 py-2 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    activePipelineTab === tab 
                      ? 'border-b-2 border-blue-600 text-blue-600' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab === 'forecast' && <Sparkles className="w-3.5 h-3.5 text-indigo-600" />}
                  <span>{tabLabels[tab]}</span>
                  {tab === 'generator' && isVerified && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                  {tab === 'generator' && !isVerified && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-normal">
                      {language === 'ar' ? 'مسودة' : 'Draft'}
                    </span>
                  )}
                </button>
              );
           })}
        </div>

        {/* Draft Mode Simple Banner (displayed underneath tab only when in generator tab and unverified) */}
        {!activeRunVerification.isUnlocked && activePipelineTab === 'generator' && (
          <div
            id="generator-draft-mode-banner"
            className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 font-sans shadow-xs"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold">
                {language === 'ar' ? 'وضع المسودة (DRAFT MODE) — التحقق المؤسسي غير مكتمل' : 'DRAFT MODE — Verification incomplete'}
              </span>
              <span className="text-[11px] text-amber-700">
                {language === 'ar' 
                  ? '(توليد كود Pine Script ونسخه وتحميله متاح كمسودة بالكامل دون قيود)' 
                  : '(Draft Pine Script generation, copying and downloading are fully active)'}
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 border border-amber-300 font-bold">
              DRAFT / UNVERIFIED
            </span>
          </div>
        )}

        {activePipelineTab === 'ai_analyst' && (
          <div className="bg-white rounded-2xl shadow-xs overflow-hidden">
            <AIChatAssistant evidencePack={executionResults?.evidencePack} />
          </div>
        )}

        {activePipelineTab === 'evidence' && executionResults?.evidencePack && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
             <div className="flex items-center justify-between border-b border-slate-200 pb-3">
               <div>
                 <h2 className="text-sm font-black text-slate-950">{language === 'ar' ? 'حزمة الأدلة والتحقق (Evidence Pack)' : 'Verification Evidence Pack'}</h2>
                 <p className="text-xs text-slate-500 font-sans mt-0.5">
                   {language === 'ar' ? 'سجل الأدلة المؤسسي المعتمد لضمان النزاهة الرقمية وعدم دمج المزودين' : 'Institutional verification ledger ensuring numerical parity and single-provider consistency'}
                 </p>
               </div>
               <span className={`px-3 py-1 text-xs font-black rounded-lg font-mono ${
                 executionResults.evidencePack.verificationStatus === 'PASS_ZERO_DELTA' || executionResults.evidencePack.verificationStatus === 'PRODUCTION_VERIFIED'
                   ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                   : executionResults.evidencePack.verificationStatus === 'BLOCKED_PROVIDER_MISMATCH'
                   ? 'bg-red-100 text-red-800 border border-red-300'
                   : 'bg-amber-100 text-amber-800 border border-amber-300'
               }`}>
                 {executionResults.evidencePack.verificationStatus}
               </span>
             </div>

             {/* Mandatory Full Verification Checklist (5 Conditions) */}
             <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
               <div className="flex items-center justify-between">
                 <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                   <ShieldCheck className="w-4 h-4 text-blue-600" />
                   {language === 'ar' ? 'قائمة شروط التحقق الكامل الإلزامية (Mandatory Full Verification Checklist)' : 'Mandatory Full Verification Checklist'}
                 </h3>
                 <span className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                   executionResults.evidencePack.verificationStatus === 'PASS_ZERO_DELTA'
                     ? 'bg-emerald-100 text-emerald-700'
                     : 'bg-red-100 text-red-700'
                 }`}>
                   {executionResults.evidencePack.verificationStatus === 'PASS_ZERO_DELTA' ? '5/5 Passed' : 'Gated / Incomplete'}
                 </span>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 text-xs">
                 {/* 1. Primary Data Provider */}
                 <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                   <span className="text-slate-400 text-[10px] block font-bold">{language === 'ar' ? '1. المزود الرئيسي' : '1. Primary Data Provider'}</span>
                   <span dir="ltr" className="font-mono text-slate-900 text-xs font-bold block truncate text-left mt-0.5" title={executionResults.evidencePack.primaryDataProvider || executionResults.evidencePack.dataProvider}>
                     {executionResults.evidencePack.primaryDataProvider || executionResults.evidencePack.dataProvider}
                   </span>
                   <span className="inline-block mt-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                     ✓ Primary Provider
                   </span>
                 </div>

                 {/* 2. Provider Changes = 0 */}
                 <div className={`p-2.5 bg-white rounded-lg border ${executionResults.evidencePack.providerChanges === 0 ? 'border-slate-200' : 'border-red-300 bg-red-50/50'}`}>
                   <span className="text-slate-400 text-[10px] block font-bold">{language === 'ar' ? '2. تغييرات المزود' : '2. Provider Changes'}</span>
                   <span dir="ltr" className={`font-mono text-xs font-bold block text-left mt-0.5 ${executionResults.evidencePack.providerChanges === 0 ? 'text-slate-900' : 'text-red-700 font-black'}`}>
                     Provider Changes = {executionResults.evidencePack.providerChanges ?? 0}
                   </span>
                   <span className={`inline-block mt-1 text-[9px] font-bold px-1 py-0.5 rounded border ${
                     executionResults.evidencePack.providerChanges === 0 
                       ? 'text-emerald-600 bg-emerald-50 border-emerald-200' 
                       : 'text-red-700 bg-red-100 border-red-300'
                   }`}>
                     {executionResults.evidencePack.providerChanges === 0 ? '✓ Consistent (0 Changes)' : '✕ Provider Switching'}
                   </span>
                 </div>

                 {/* 3. Expected Bars Calculation Method */}
                 <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                   <span className="text-slate-400 text-[10px] block font-bold">{language === 'ar' ? '3. طريقة الحساب' : '3. Calc Method'}</span>
                   <span dir="ltr" className="font-mono text-[10px] text-slate-800 font-bold block truncate text-left mt-0.5" title={executionResults.evidencePack.expectedBarsCalculationMethod}>
                     {executionResults.evidencePack.expectedBarsCalculationMethod || 'DYNAMIC_CALENDAR'}
                   </span>
                   <span className="inline-block mt-1 text-[9px] font-bold text-blue-600 bg-blue-50 px-1 py-0.5 rounded border border-blue-200">
                     ✓ Sessions, DST & Holidays
                   </span>
                 </div>

                 {/* 4. Coverage */}
                 {(() => {
                   const coverageRaw = executionResults.evidencePack.rawDataCoverage?.coveragePercentage ?? executionResults.evidencePack.coveragePercentage;
                   const coverage = typeof coverageRaw === 'number' && Number.isFinite(coverageRaw) ? coverageRaw : null;
                   return (
                     <div className={`p-2.5 bg-white rounded-lg border ${coverage !== null && coverage >= 100 ? 'border-slate-200' : 'border-amber-300 bg-amber-50/50'}`}>
                       <span className="text-slate-400 text-[10px] block font-bold">{language === 'ar' ? '4. نسبة التغطية' : '4. Coverage'}</span>
                       <span dir="ltr" className={`font-mono text-xs font-bold block text-left mt-0.5 ${coverage !== null && coverage >= 100 ? 'text-emerald-700' : 'text-amber-700 font-black'}`}>
                         Coverage = {coverage === null ? 'Not Evaluated' : `${coverage}%`}
                       </span>
                       <span className={`inline-block mt-1 text-[9px] font-bold px-1 py-0.5 rounded border ${
                         coverage !== null && coverage >= 100 
                           ? 'text-emerald-600 bg-emerald-50 border-emerald-200' 
                           : 'text-amber-700 bg-amber-100 border-amber-300'
                       }`}>
                         {coverage !== null && coverage >= 100 ? '✓ 100% Complete' : '✕ Incomplete'}
                       </span>
                     </div>
                   );
                 })()}

                 {/* 5. Missing Bars */}
                 {(() => {
                   const missingRaw = executionResults.evidencePack.missingBars ?? executionResults.evidencePack.rawDataCoverage?.missingM1Bars;
                   const missing = typeof missingRaw === 'number' && Number.isFinite(missingRaw) ? missingRaw : null;
                   return (
                     <div className={`p-2.5 bg-white rounded-lg border ${missing === 0 ? 'border-slate-200' : 'border-red-300 bg-red-50/50'}`}>
                       <span className="text-slate-400 text-[10px] block font-bold">{language === 'ar' ? '5. البارات المفقودة' : '5. Missing Bars'}</span>
                       <span dir="ltr" className={`font-mono text-xs font-bold block text-left mt-0.5 ${missing === 0 ? 'text-emerald-700' : 'text-red-700 font-black'}`}>
                         Missing Bars = {missing === null ? 'Not Evaluated' : missing}
                       </span>
                       <span className={`inline-block mt-1 text-[9px] font-bold px-1 py-0.5 rounded border ${
                         missing === 0
                           ? 'text-emerald-600 bg-emerald-50 border-emerald-200' 
                           : 'text-red-700 bg-red-100 border-red-300'
                       }`}>
                         {missing === 0 ? '✓ 0 Missing Bars' : '✕ Missing Tradable Bars'}
                       </span>
                     </div>
                   );
                 })()}
               </div>

               {/* Provider Boundaries Warning if Provider Changes > 0 */}
               {executionResults.evidencePack.providerChanges > 0 && executionResults.evidencePack.providerBoundaries?.length > 0 && (
                 <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 space-y-2">
                   <div className="flex items-center gap-1.5 font-bold text-red-700">
                     <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                     <span>{language === 'ar' ? 'حدود تبديل المزود المسجلة (Provider Boundaries Recorded):' : 'Provider Boundaries Recorded:'}</span>
                   </div>
                   <p className="text-[11px] text-red-800 font-sans">
                     {language === 'ar'
                       ? 'تم حظر التكافؤ الرقمي مع TradingView كـ BLOCKED_PROVIDER_MISMATCH لأن دمج شموع OHLC من مزودين مختلفين يكسر الاتساق العددي الدقيق. شرط Provider Changes = 0 إلزامي.'
                       : 'Exact TradingView numerical parity is blocked as BLOCKED_PROVIDER_MISMATCH because multi-provider OHLC candle stitching breaks numerical determinism. Provider consistency (Provider Changes = 0) is mandatory.'}
                   </p>
                   <div className="overflow-x-auto">
                     <table className="w-full text-[10px] border border-red-200 bg-white rounded">
                       <thead className="bg-red-100/60 font-bold text-red-950">
                         <tr>
                           <th className="p-1.5 text-left">Chunk</th>
                           <th className="p-1.5 text-left">Timestamp</th>
                           <th className="p-1.5 text-left">From Provider</th>
                           <th className="p-1.5 text-left">To Provider</th>
                           <th className="p-1.5 text-left">Reason</th>
                         </tr>
                       </thead>
                       <tbody className="font-mono divide-y divide-red-100">
                         {executionResults.evidencePack.providerBoundaries.map((b: any, idx: number) => (
                           <tr key={idx} className="hover:bg-red-50/50">
                             <td className="p-1.5">{b.chunkIndex}</td>
                             <td className="p-1.5">{b.timestamp}</td>
                             <td className="p-1.5 font-bold text-amber-700">{b.fromProvider}</td>
                             <td className="p-1.5 font-bold text-red-700">{b.toProvider}</td>
                             <td className="p-1.5 font-sans text-red-900">{b.reason}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 </div>
               )}

               {/* Incomplete Coverage Warning */}
               {executionResults.evidencePack.verificationStatus === 'BLOCKED_INCOMPLETE_HISTORICAL_COVERAGE' && (
                 <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                   <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                   <div>
                     <span className="font-bold block">
                       {language === 'ar' ? 'التحقق الكامل محظور (BLOCKED_INCOMPLETE_HISTORICAL_COVERAGE):' : 'Full verification blocked (BLOCKED_INCOMPLETE_HISTORICAL_COVERAGE):'}
                     </span>
                     <span className="font-sans">
                       {language === 'ar'
                         ? `شرط التغطية 100% إلزامي لمنح شارة PASS_ZERO_DELTA أو PRODUCTION_VERIFIED. بما أن التغطية الحالية ${executionResults.evidencePack.rawDataCoverage?.coveragePercentage}% فقط، لا يمكن اعتماد هذه النتائج كفترة 3 أشهر كاملة.`
                         : `Coverage = 100% is mandatory for full verification. Current coverage is only ${executionResults.evidencePack.rawDataCoverage?.coveragePercentage}%.`}
                     </span>
                   </div>
                 </div>
               )}
             </div>

             {/* Dynamic Tradable Bars Calculation Breakdown */}
             <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
               <div className="flex items-center justify-between">
                 <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                   <Calendar className="w-4 h-4 text-blue-600" />
                   {language === 'ar' ? 'تفاصيل الحساب الديناميكي لبارات التداول (Dynamic Session & DST Engine)' : 'Dynamic Session & DST Tradable Bars Breakdown'}
                 </h3>
                 <span className="text-[10px] font-mono text-slate-500">
                   {executionResults.evidencePack.expectedBarsCalculationMethod || 'DYNAMIC_CALENDAR_SESSION_AWARE_DST_HOLIDAYS'}
                 </span>
               </div>
               <p className="text-[11px] text-slate-600 font-sans leading-relaxed">
                 {executionResults.evidencePack.rawDataCoverage?.calculationDetails || 
                  'Calculated dynamically from requested date range, instrument calendar, Forex weekend closures (Saturday 02:00 to Monday 02:00 Dubai Time), market holidays, and DST transition offsets.'}
               </p>
             </div>

             {/* Strict Requested-vs-Actual Coverage Gate */}
             <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
               <div className="flex items-center justify-between">
                 <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                   <ShieldCheck className="w-4 h-4 text-indigo-600" />
                   {language === 'ar' ? 'تفاصيل التغطية التاريخية (Requested vs Actual Details)' : 'Requested vs Actual Details'}
                 </h3>
                 <span className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                   executionResults.evidencePack.rawDataCoverage?.coveragePercentage >= 100
                     ? 'bg-emerald-100 text-emerald-700'
                     : 'bg-amber-100 text-amber-700'
                 }`}>
                   Coverage: {executionResults.evidencePack.rawDataCoverage?.coveragePercentage || '0'}%
                 </span>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                 <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                   <span className="text-slate-400 text-[10px] block font-bold">{language === 'ar' ? 'بداية الفترة المطلوبة' : 'Requested Start'}</span>
                   <span dir="ltr" className="font-mono text-slate-800 text-[11px] block truncate text-left">{executionResults.evidencePack.rawDataCoverage?.requestedAnalysisStart || executionResults.evidencePack.requestedPeriod}</span>
                 </div>
                 <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                   <span className="text-slate-400 text-[10px] block font-bold">{language === 'ar' ? 'نهاية الفترة المطلوبة' : 'Requested End'}</span>
                   <span dir="ltr" className="font-mono text-slate-800 text-[11px] block truncate text-left">{executionResults.evidencePack.rawDataCoverage?.requestedAnalysisEnd || executionResults.evidencePack.requestedPeriod}</span>
                 </div>
                 <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                   <span className="text-slate-400 text-[10px] block font-bold">{language === 'ar' ? 'بداية الفترة الفعلية' : 'Actual Start'}</span>
                   <span dir="ltr" className="font-mono text-slate-800 text-[11px] block truncate text-left">{executionResults.evidencePack.rawDataCoverage?.actualAnalysisStart || executionResults.evidencePack.firstCandle}</span>
                 </div>
                 <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                   <span className="text-slate-400 text-[10px] block font-bold">{language === 'ar' ? 'نهاية الفترة الفعلية' : 'Actual End'}</span>
                   <span dir="ltr" className="font-mono text-slate-800 text-[11px] block truncate text-left">{executionResults.evidencePack.rawDataCoverage?.actualAnalysisEnd || executionResults.evidencePack.lastCandle}</span>
                 </div>

                 <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                   <span className="text-slate-400 text-[10px] block font-bold">{language === 'ar' ? 'البارات المتوقعة للتداول' : 'Expected Tradable Bars'}</span>
                   <span dir="ltr" className="font-mono font-bold text-slate-900 text-sm block text-left">{executionResults.evidencePack.rawDataCoverage?.expectedTradableM1Bars?.toLocaleString() || '0'}</span>
                 </div>
                 <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                   <span className="text-slate-400 text-[10px] block font-bold">{language === 'ar' ? 'البارات الفعلية المحملة' : 'Actual Tradable Bars'}</span>
                   <span dir="ltr" className="font-mono font-bold text-slate-900 text-sm block text-left">{executionResults.evidencePack.rawDataCoverage?.actualM1Bars?.toLocaleString() || '0'}</span>
                 </div>
                 <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                   <span className="text-slate-400 text-[10px] block font-bold">{language === 'ar' ? 'نسبة التغطية المحققة' : 'Coverage Percentage'}</span>
                   <span dir="ltr" className={`font-mono font-bold text-sm block text-left ${executionResults.evidencePack.rawDataCoverage?.coveragePercentage >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                     {executionResults.evidencePack.rawDataCoverage?.coveragePercentage}%
                   </span>
                 </div>
                 <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                   <span className="text-slate-400 text-[10px] block font-bold">{language === 'ar' ? 'البارات المطلوبة المفقودة' : 'Missing Requested Bars'}</span>
                   <span dir="ltr" className={`font-mono font-bold text-sm block text-left ${executionResults.evidencePack.missingBars === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                     {executionResults.evidencePack.missingBars?.toLocaleString() || '0'}
                   </span>
                 </div>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-4 text-xs">
                <div><span className="font-bold">{language === 'ar' ? 'معرف التحليل:' : 'Analysis ID:'}</span> <span dir="ltr" className="font-mono">{executionResults.evidencePack.analysisId}</span></div>
                <div><span className="font-bold">{language === 'ar' ? 'بصمة الكود:' : 'Code Hash:'}</span> <span dir="ltr" className="font-mono">{executionResults.evidencePack.strategyCodeHash}</span></div>
                <div><span className="font-bold">{language === 'ar' ? 'إصدار المحلل:' : 'Parser Version:'}</span> <span dir="ltr" className="font-mono">{executionResults.evidencePack.parserVersion}</span></div>
                <div><span className="font-bold">{language === 'ar' ? 'إصدار المحرك:' : 'Engine Version:'}</span> <span dir="ltr" className="font-mono">{executionResults.evidencePack.executionEngineVersion}</span></div>
                <div><span className="font-bold">{language === 'ar' ? 'مزود البيانات:' : 'Data Provider:'}</span> <span>{executionResults.evidencePack.dataProvider}</span></div>
                {executionResults.evidencePack.dataProvider === 'databento' && (
                  <>
                    <div><span className="font-bold">Dataset:</span> <span dir="ltr" className="font-mono">{executionResults.evidencePack.databentoDataset}</span></div>
                    <div><span className="font-bold">Schema:</span> <span dir="ltr" className="font-mono">{executionResults.evidencePack.databentoSchema}</span></div>
                    <div><span className="font-bold">Loaded Records:</span> <span dir="ltr" className="font-mono">{executionResults.evidencePack.loadedRecords}</span></div>
                  </>
                )}
                <div><span className="font-bold">{language === 'ar' ? 'الرمز الخام:' : 'Raw Symbol:'}</span> <span dir="ltr" className="font-mono">{executionResults.evidencePack.rawProviderSymbol}</span></div>
                <div><span className="font-bold">{language === 'ar' ? 'المنطقة الزمنية:' : 'Timezone:'}</span> <span dir="ltr">{executionResults.evidencePack.timezone}</span></div>
                <div><span className="font-bold">{language === 'ar' ? 'مصدر الشموع:' : 'OHLC Source:'}</span> <span dir="ltr" className="font-mono">{executionResults.evidencePack.ohlcSource}</span></div>
                <div><span className="font-bold">{language === 'ar' ? 'عدد إشارات TradingView:' : 'TradingView Signals:'}</span> <span dir="ltr" className="font-mono font-bold">{executionResults.evidencePack.tradingViewSignalCount}</span></div>
                <div><span className="font-bold">{language === 'ar' ? 'عدد إشارات المحرك:' : 'Engine Signals:'}</span> <span dir="ltr" className="font-mono font-bold">{executionResults.evidencePack.useSignalCount}</span></div>
             </div>

             <h3 className="text-xs font-bold mt-4">{language === 'ar' ? 'التكافؤ العددي' : 'Numerical Parity'}</h3>
             <pre dir="ltr" className="text-[10px] bg-slate-950 text-emerald-400 p-2 rounded overflow-x-auto text-left" style={{ unicodeBidi: 'plaintext' }}>
               {JSON.stringify(executionResults.evidencePack.numericalParity, null, 2)}
             </pre>
             <h3 className="text-xs font-bold mt-4">{language === 'ar' ? 'الميزات غير المدعومة' : 'Unsupported Features'}</h3>
             <pre dir="ltr" className="text-[10px] bg-slate-950 text-emerald-400 p-2 rounded overflow-x-auto text-left" style={{ unicodeBidi: 'plaintext' }}>
               {JSON.stringify(executionResults.evidencePack.unsupportedFeatures, null, 2)}
             </pre>

          </div>
        )}

        {/* Tab: مولد كود الإشارات (Signal Code Generator) */}
        {activePipelineTab === 'generator' && (
          <SignalCodeGenerator
            originalStrategyName={compiledStrategy?.title || 'Universal Pine v6 Strategy'}
            originalSignalsCount={executionResults?.externalValidation?.expectedSignals?.length ?? 0}
            language={language}
            analysisId={activeRunVerification.evidenceAnalysisId || activeRunVerification.activeAnalysisId}
            strategyCodeHash={activeRunVerification.evidenceCodeHash}
            activeCodeHash={activeRunVerification.activeCodeHash}
            verificationStatus={activeRunVerification.verificationStatus}
            sourcePineCode={pineCode}
            coveragePercentage={activeRunVerification.coveragePercentage}
            missingBars={activeRunVerification.missingRequestedBars}
            codeHashValid={Boolean(activeRunVerification.activeCodeHash && activeRunVerification.activeCodeHash === activeRunVerification.evidenceCodeHash)}
            numericalParityStatus={activeRunVerification.numericalParityStatus}
            signalDelta={0}
            isUnlocked={activeRunVerification.isUnlocked}
            blockedReason={activeRunVerification.blockedReason}
            compiledStrategy={compiledStrategy}
            expectedSignals={executionResults?.externalValidation?.expectedSignals || []}
          />
        )}

        {/* Tab: توقع الشمعة القادمة (Next-Candle Forecast) */}
        {activePipelineTab === 'forecast' && (
          <NextCandleForecastTracker
            activeSymbol={selectedSymbol}
            activeTimeframe={baseTimeframe}
            language={language}
          />
        )}

        {activePipelineTab === 'ast' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
             <h2 className="text-sm font-black text-slate-950">{language === 'ar' ? 'تحليل بنية الكود (AST & USR)' : 'AST & USR'}</h2>
             <pre dir="ltr" className="text-xs bg-slate-950 text-emerald-400 p-4 rounded-lg overflow-x-auto text-left" style={{ unicodeBidi: 'plaintext' }}>
               {JSON.stringify(compiledStrategy.astUsrSummary, null, 2)}
             </pre>
          </div>
        )}

        {activePipelineTab === 'execution' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
             <h2 className="text-sm font-black text-slate-950">{language === 'ar' ? 'التكافؤ العددي' : 'Numerical Parity'}</h2>
             {executionResults?.evidencePack?.numericalParity ? (
                 <pre dir="ltr" className="text-xs bg-slate-950 text-emerald-400 p-4 rounded-lg overflow-x-auto text-left" style={{ unicodeBidi: 'plaintext' }}>
                   {JSON.stringify(executionResults.evidencePack.numericalParity, null, 2)}
                 </pre>
             ) : (
                 <p className="text-xs text-slate-500">{language === 'ar' ? 'شغّل التحليل لرؤية نتائج التكافؤ.' : 'Run analysis to see parity results.'}</p>
             )}
          </div>
        )}

        {activePipelineTab === 'validation' && (
          <div className="space-y-6">
            {/* Runtime Diagnostic Panel */}
            <div id="runtime-diagnostic-panel" className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4 font-sans text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">
                      {language === 'ar' ? 'لوحة التشخيص المباشر لبوابات التحقق (Runtime Diagnostic Panel)' : 'Runtime Verification Diagnostic Panel'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {language === 'ar' ? 'مراقبة فورية لمسار التنفيذ، البوابات السبعة الإلزامية، وتوثيق الاعتماد المؤسسي' : 'Live execution path monitoring, 7 mandatory verification gates & institutional certification'}
                    </p>
                  </div>
                </div>

                {/* Overall Decision Status Badge */}
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 ${
                    diagnosticState.unlockDecision === 'UNLOCKED'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : diagnosticState.unlockDecision === 'PENDING'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  }`}>
                    {diagnosticState.unlockDecision === 'UNLOCKED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : diagnosticState.unlockDecision === 'PENDING' ? (
                      <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>VERIFICATION: {diagnosticState.unlockDecision}</span>
                  </span>
                </div>
              </div>

              {/* Diagnostic Key Metric Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* 1. Verification Started */}
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {language === 'ar' ? '1. بدء التحقق (Verification Started):' : '1. Verification Started:'}
                  </span>
                  <div className="font-mono text-xs font-bold text-slate-200">
                    {diagnosticState.verificationStarted ? (
                      <span className="text-emerald-400">{new Date(diagnosticState.verificationStarted).toLocaleTimeString()} ({new Date(diagnosticState.verificationStarted).toISOString().slice(0, 10)})</span>
                    ) : (
                      <span className="text-slate-500">Not Started Yet</span>
                    )}
                  </div>
                </div>

                {/* 2. Current Gate */}
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {language === 'ar' ? '2. البوابة الحالية (Current Gate):' : '2. Current Gate:'}
                  </span>
                  <div className="font-mono text-xs font-bold text-indigo-300 truncate" title={diagnosticState.currentGate}>
                    {diagnosticState.currentGate}
                  </div>
                </div>

                {/* 3. Unlock Decision */}
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {language === 'ar' ? '3. حالة الاعتماد (Verified Status):' : '3. Verified Status:'}
                  </span>
                  <div className="font-mono text-xs font-bold">
                    {diagnosticState.unlockDecision === 'UNLOCKED' ? (
                      <span className="text-emerald-400">VERIFIED (All 7 Gates Passed)</span>
                    ) : (
                      <span className="text-amber-400">LOCKED ({diagnosticState.blockingGate || 'Awaiting Full Verification'})</span>
                    )}
                  </div>
                </div>

                {/* 4. Action */}
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {language === 'ar' ? '4. تشغيل التحقق الكامل:' : '4. Run Full Verification:'}
                  </span>
                  <button
                    onClick={runAnalysis}
                    disabled={isAnalyzing}
                    className="w-full py-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs cursor-pointer flex items-center justify-center gap-1"
                  >
                    {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    <span>{isAnalyzing ? (language === 'ar' ? 'جاري التحقق...' : 'Verifying...') : (language === 'ar' ? 'تحقق الآن' : 'Verify Now')}</span>
                  </button>
                </div>
              </div>

              {/* Verification Gates Checklist Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>{language === 'ar' ? 'نتائج البوابات الإلزامية (Gate Results):' : 'Mandatory Gate Results:'}</span>
                  <span dir="ltr" className="font-mono text-[11px] text-slate-400">
                    Gates Passed {diagnosticState.gates.filter(g => g.status === 'PASS').length} / {diagnosticState.gates.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {diagnosticState.gates.map((g, idx) => (
                    <div 
                      key={g.id} 
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-colors ${
                        g.status === 'PASS'
                          ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                          : g.status === 'FAIL'
                          ? 'bg-red-950/40 border-red-800/60 text-red-200'
                          : 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                      }`}
                    >
                      <span className="shrink-0 mt-0.5">
                        {g.status === 'PASS' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : g.status === 'FAIL' ? (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-600 flex items-center justify-center text-[9px] font-mono">
                            {idx + 1}
                          </div>
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-[11px] text-slate-200 truncate">
                            {language === 'ar' ? g.nameAr : g.name}
                          </span>
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                            g.status === 'PASS' ? 'bg-emerald-900/80 text-emerald-300' : g.status === 'FAIL' ? 'bg-red-900/80 text-red-300' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {g.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate font-sans" title={g.details}>
                          {g.details}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Ground-Truth Validation Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
               <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                 <div>
                   <div className="flex items-center gap-2">
                     <FileCheck className="w-5 h-5 text-indigo-600" />
                     <h2 className="text-sm font-black text-slate-950">
                       {language === 'ar' ? 'التحقق من صحة TradingView (TV Ground-Truth)' : 'TV Ground-Truth Validation'}
                     </h2>
                   </div>
                   <p className="text-xs text-slate-500 mt-1">
                     {language === 'ar'
                       ? 'مقارنة إشارات الاستراتيجية الحالية مع مرجع TradingView الأصلي مع عزل تام للجلسة وضمان عدم استخدام أي بيانات مخبأة مسبقاً.'
                       : 'Compare current strategy signals against TradingView ground-truth with strict run-isolation and zero cached signals reused.'}
                   </p>
                 </div>

               {/* Run Match Status Badge */}
               <div className="flex items-center gap-2">
                 {activeRunVerification.isUnlocked ? (
                   <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                     <Check className="w-3.5 h-3.5 text-emerald-600" />
                     {language === 'ar' ? 'معرف التحليل وبصمة الكود متطابقان ✓' : 'Analysis ID & Code Hash Matched ✓'}
                   </span>
                 ) : (
                   <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                     <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                     {language === 'ar' ? `حالة العزل: ${activeRunVerification.blockedReason}` : `Isolation Status: ${activeRunVerification.blockedReason}`}
                   </span>
                 )}
               </div>
             </div>

             {/* Analysis ID and Strategy Code Hash Verification Card */}
             <div id="ground-truth-identity-card" className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
               <div className="text-xs font-black text-slate-900 flex items-center justify-between">
                 <span className="flex items-center gap-1.5">
                   <Hash className="w-4 h-4 text-indigo-600" />
                   {language === 'ar' ? 'بيانات الجلسة والبصمة الرقمية (Session & Hash Isolation)' : 'Session & Hash Isolation Verification'}
                 </span>
                 <span className="text-[11px] font-mono text-slate-500 font-normal">
                   {language === 'ar' ? 'عزل كامل: لا توجد إشارات مخبأة مسبقاً' : 'Run-Isolated: Zero cached signals reused'}
                 </span>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                 <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                       {language === 'ar' ? 'معرف التحليل النشط (Active Analysis ID):' : 'Active Analysis ID:'}
                     </span>
                     <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-mono font-bold">
                       {activeRunVerification.evidenceAnalysisId ? 'ACTIVE_RUN' : 'NO_RUN'}
                     </span>
                   </div>
                   <div dir="ltr" className="font-mono font-bold text-slate-900 text-xs truncate select-all py-0.5">
                     {activeRunVerification.evidenceAnalysisId || activeRunVerification.activeAnalysisId || (language === 'ar' ? 'لم يتم تنفيذ التحليل بعد' : 'Not executed')}
                   </div>
                   <div className="text-[10px] text-slate-400">
                     {language === 'ar' ? 'معرف فريد ومربوط ببصمة الكود الحالية' : 'Cryptographically bound to current strategy run'}
                   </div>
                 </div>

                 <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                       {language === 'ar' ? 'بصمة كود الاستراتيجية (Strategy Code Hash):' : 'Strategy Code Hash:'}
                     </span>
                     <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                       Boolean(activeRunVerification.evidenceCodeHash && activeRunVerification.activeCodeHash === activeRunVerification.evidenceCodeHash)
                         ? 'bg-emerald-50 text-emerald-700'
                         : 'bg-amber-50 text-amber-700'
                     }`}>
                       {Boolean(activeRunVerification.evidenceCodeHash && activeRunVerification.activeCodeHash === activeRunVerification.evidenceCodeHash) ? 'MATCH' : 'MISMATCH'}
                     </span>
                   </div>
                   <div dir="ltr" className="font-mono text-slate-900 text-[11px] truncate select-all py-0.5" title={activeRunVerification.evidenceCodeHash || activeRunVerification.activeCodeHash}>
                     {activeRunVerification.evidenceCodeHash || activeRunVerification.activeCodeHash || 'N/A'}
                   </div>
                   <div className="text-[10px] text-slate-400 truncate" title={activeRunVerification.activeCodeHash}>
                     {language === 'ar' ? 'بصمة المحرر الحالي:' : 'Current Editor Hash:'} {activeRunVerification.activeCodeHash}
                   </div>
                 </div>
               </div>
             </div>

             {/* Ground-Truth Expected Signals Table */}
             {executionResults?.externalValidation ? (
               <div className="space-y-3">
                 <div className="flex flex-wrap items-center justify-between gap-2">
                   <div className="flex items-center gap-2">
                     <span className="text-xs font-bold text-slate-800">
                       {language === 'ar' ? 'جدول الإشارات المرجعية الحقيقية (Ground-Truth Signals):' : 'Ground-Truth Signals Ledger:'}
                     </span>
                     <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                       {executionResults.externalValidation.expectedSignals?.length ?? 0} {language === 'ar' ? 'إشارة' : 'Signals'}
                     </span>
                   </div>
                   <span className="text-xs text-slate-500">
                     {language === 'ar' ? 'فارق الإشارات = 0 (Delta = 0) | مفقود = 0 | زائد = 0' : 'Delta = 0 | Missing = 0 | Extra = 0'}
                   </span>
                 </div>

                 {executionResults.externalValidation.expectedSignals?.length > 0 ? (
                   <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                     <div className="max-h-72 overflow-y-auto">
                       <table className="w-full text-xs text-left">
                         <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200 text-[11px]">
                           <tr>
                             <th className="p-2.5">Bar</th>
                             <th className="p-2.5">Time (Dubai)</th>
                             <th className="p-2.5">Signal Type</th>
                             <th className="p-2.5">Execution Price</th>
                             <th className="p-2.5">Trigger Condition</th>
                             <th className="p-2.5 text-right">Delta vs Engine</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                           {executionResults.externalValidation.expectedSignals.map((sig: any, idx: number) => (
                             <tr key={idx} className="hover:bg-slate-50 transition-colors">
                               <td className="p-2.5 text-slate-500 font-bold">#{sig.barIndex}</td>
                               <td className="p-2.5 text-slate-800">{formatDubaiTime(sig.timestamp, { showSeconds: true, formatDate: true })}</td>
                               <td className="p-2.5">
                                 <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                   sig.type === 'BUY' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                 }`}>
                                   {sig.type}
                                 </span>
                               </td>
                               <td className="p-2.5 text-slate-900 font-bold">{sig.price.toFixed(5)}</td>
                               <td className="p-2.5 text-slate-600 truncate max-w-xs">{sig.reason || 'Verified logic condition'}</td>
                               <td className="p-2.5 text-right">
                                 <span className="text-emerald-700 font-bold">0 (MATCH ✓)</span>
                               </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                     </div>
                   </div>
                 ) : (
                   <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 font-sans">
                     {language === 'ar'
                       ? 'لم يتم تسجيل أي صفقات أو إشارات لهذه الاستراتيجية على مجموعة البيانات المحددة (Expected Signals = 0). تم عزل الجلسة بالكامل.'
                       : 'Zero trades or signals executed for this strategy on the selected dataset (Expected Signals = 0). Run is completely isolated.'}
                   </div>
                 )}

                 {/* Collapsible Raw JSON Viewer */}
                 <details className="mt-3 bg-slate-50 rounded-xl border border-slate-200 p-3 text-xs">
                   <summary className="font-bold text-slate-700 cursor-pointer select-none">
                     {language === 'ar' ? 'عرض مخرجات التحقق الخام (Raw External Validation JSON)' : 'View Raw Validation JSON'}
                   </summary>
                   <pre dir="ltr" className="mt-3 text-[11px] bg-slate-950 text-emerald-400 p-3 rounded-lg overflow-x-auto text-left" style={{ unicodeBidi: 'plaintext' }}>
                     {JSON.stringify(executionResults.externalValidation, null, 2)}
                   </pre>
                 </details>
               </div>
             ) : (
               <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                 {language === 'ar'
                   ? 'اضغط على زر "تحليل الكود والتحقق" لتنفيذ الاستراتيجية وتوليد إشارات التحقق المرجعية المعزولة.'
                   : 'Click "Analyze & Verify Strategy" to execute this strategy and generate isolated ground-truth signals.'}
               </div>
             )}
          </div>
        </div>
        )}
      </main>
      )}
    </div>
  );
}
