import React from 'react';
import { X, ShieldAlert, BookOpen, ExternalLink, HelpCircle } from 'lucide-react';

export default function AboutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content legal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="legal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HelpCircle size={24} className="header-logo-icon" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>About Satranj & Licenses</h3>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="legal-body">
          {/* Intro Section */}
          <div>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Satranj</strong> is a premium, open-source web chess application featuring rule validation, audio synthesizers, customizable timers, and an offline Stockfish AI engine.
            </p>
            <p>
              Version 1.0.0. Licensed under the <strong>GNU General Public License v3 (GPL-3.0)</strong>.
            </p>
          </div>

          {/* GPL compliance box */}
          <div className="info-alert">
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <strong>GPL-3.0 License Notice & Warranty Disclaimer</strong>
            </div>
            This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, version 3.
            <br />
            This program is distributed in the hope that it will be useful, but <strong>WITHOUT ANY WARRANTY</strong>; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the full license details below.
          </div>

          {/* Stockfish usage */}
          <div>
            <h4 className="legal-section-title">Stockfish AI Integration</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              This application integrates <strong>Stockfish</strong>, a powerful open-source chess engine. The engine runs locally in your browser using WebAssembly and Web Workers.
            </p>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <li>
                Official Stockfish Engine Core: licensed under GPL-3.0. Source code is available at{' '}
                <a href="https://github.com/official-stockfish/Stockfish" target="_blank" rel="noreferrer" className="link-styled">
                  official-stockfish/Stockfish <ExternalLink size={10} style={{ display: 'inline' }} />
                </a>.
              </li>
              <li>
                Stockfish.js Wasm compiled port: compiled by Niklas Rugg. Licensed under GPL-3.0. Source code is available at{' '}
                <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noreferrer" className="link-styled">
                  nmrugg/stockfish.js <ExternalLink size={10} style={{ display: 'inline' }} />
                </a>.
              </li>
            </ul>
          </div>

          {/* Source Code */}
          <div>
            <h4 className="legal-section-title">Satranj Application Source Code</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              In compliance with the GPL-3.0 license terms, the full source code for this application is free and publicly available. You can study, copy, modify, and redistribute it under the same license terms.
            </p>
          </div>

          {/* GPL License text snippet */}
          <div>
            <h4 className="legal-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <BookOpen size={14} /> Full License Text
            </h4>
            <div className="license-box">
              GNU GENERAL PUBLIC LICENSE
              Version 3, 29 June 2007

              Copyright (C) 2007 Free Software Foundation, Inc. &lt;https://fsf.org/&gt;
              Everyone is permitted to copy and distribute verbatim copies of this license document, but changing it is not allowed.

              Preamble
              The GNU General Public License is a free, copyleft license for software and other kinds of works.
              
              [Full license terms are stored in the LICENSE file in the project's root folder.]
              
              TERMS AND CONDITIONS:
              0. Definitions.
              1. Source Code.
              2. Basic Permissions.
              3. Protecting Users' Legal Rights From Anti-Circumvention Law.
              4. Conveying Verbatim Copies.
              5. Conveying Modified Source Versions.
              6. Conveying Non-Source Forms.
              7. Additional Terms.
              8. Termination.
              9. Acceptance Not Required for Having Copies.
              10. Automatic Licensing of Downstream Recipients.
              11. Patents.
              12. No Surrender of Others' Freedom.
              13. Use with the GNU Affero General Public License.
              14. Revised Versions of this License.
              15. Disclaimer of Warranty: THERE IS NO WARRANTY...
              16. Limitation of Liability: IN NO EVENT UNLESS REQUIRED...
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={onClose}>
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
