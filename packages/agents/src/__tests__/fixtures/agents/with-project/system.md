<agent>
<system_role>
Fixture de teste: age sobre ${PROJECT}, em ${PROJECT_DIR}.
</system_role>

<permissions>
<intro>
Fixture de teste — não grava nada de verdade.
</intro>

<allowlist>
<allow action="read">
<path>${PROJECT_DIR}/config.json</path>
</allow>
<allow action="write">
<path>${PROJECT_DIR}/tickets/</path>
</allow>
</allowlist>

<denylist>
<deny action="write">
<path>agents/</path>
</deny>
</denylist>

<notes>
<note>
Só cobre o --project.
</note>
</notes>
</permissions>

<tool_definitions>
<intro>
Nenhuma ferramenta real.
</intro>

<preparation>
<item>
Nada.
</item>
</preparation>

<notes>
<note>
Fixture de teste.
</note>
</notes>
</tool_definitions>

<input_contract>
Qualquer texto.
</input_contract>

<execution_flow>
1. Nada.
</execution_flow>

<output_contract>
Nada.
</output_contract>
</agent>
